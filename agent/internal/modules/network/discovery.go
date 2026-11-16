package network

import (
	"bufio"
	"context"
	"errors"
	"net"
	"net/netip"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type Interface struct {
	Name    string  `json:"name"`
	CIDR    string  `json:"cidr"`
	Gateway *string `json:"gateway"`
}
type Neighbor struct {
	Address  string  `json:"address"`
	MAC      *string `json:"mac"`
	Evidence string  `json:"evidence"`
}
type Inventory struct {
	Interfaces []Interface `json:"interfaces"`
	Neighbors  []Neighbor  `json:"neighbors"`
}

func Allowed(cidrs []string, address string) bool {
	ip, err := netip.ParseAddr(address)
	if err != nil || !ip.Is4() || !ip.IsPrivate() {
		return false
	}
	for _, raw := range cidrs {
		p, e := netip.ParsePrefix(raw)
		if e == nil && p.Addr().Is4() && p.Contains(ip) {
			return true
		}
	}
	return false
}
func ValidateScope(cidrs []string) error {
	if len(cidrs) == 0 || len(cidrs) > 8 {
		return errors.New("network prefix limit")
	}
	for _, raw := range cidrs {
		p, e := netip.ParsePrefix(raw)
		if e != nil || !p.Addr().Is4() || !p.Addr().IsPrivate() || p.Bits() < 8 || p.Bits() > 30 {
			return errors.New("private IPv4 prefix required")
		}
		first := p.Masked().Addr()
		last := first.As4()
		bits := uint32(last[0])<<24 | uint32(last[1])<<16 | uint32(last[2])<<8 | uint32(last[3])
		bits |= (1 << uint(32-p.Bits())) - 1
		end := netip.AddrFrom4([4]byte{byte(bits >> 24), byte(bits >> 16), byte(bits >> 8), byte(bits)})
		if !first.IsPrivate() || !end.IsPrivate() {
			return errors.New("prefix leaves private space")
		}
	}
	return nil
}
func normalizedMAC(raw string) *string {
	parts := strings.Split(raw, ":")
	if len(parts) == 6 {
		for n, part := range parts {
			if len(part) == 1 {
				parts[n] = "0" + part
			}
		}
		raw = strings.Join(parts, ":")
	}
	m, e := net.ParseMAC(raw)
	if e != nil || len(m) != 6 || m[0]&1 != 0 {
		return nil
	}
	s := strings.ToLower(m.String())
	if s == "00:00:00:00:00:00" {
		return nil
	}
	return &s
}

// ParseARP consumes numeric passive cache output only; it sends no probe or reverse-DNS lookup.
func ParseARP(raw string, linux bool, cidrs []string) []Neighbor {
	out := []Neighbor{}
	seen := map[string]bool{}
	scanner := bufio.NewScanner(strings.NewReader(raw))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 4 {
			continue
		}
		address, mac := "", ""
		if linux {
			if len(fields) < 6 {
				continue
			}
			address = fields[0]
			flags, e := strconv.ParseUint(strings.TrimPrefix(fields[2], "0x"), 16, 32)
			if e != nil || flags&2 == 0 {
				continue
			}
			mac = fields[3]
		} else {
			for i, f := range fields {
				if strings.HasPrefix(f, "(") && strings.HasSuffix(f, ")") {
					address = strings.Trim(f, "()")
				}
				if f == "at" && i+1 < len(fields) {
					mac = fields[i+1]
				}
			}
		}
		if !Allowed(cidrs, address) || seen[address] {
			continue
		}
		m := normalizedMAC(mac)
		if m == nil {
			continue
		}
		seen[address] = true
		out = append(out, Neighbor{address, m, "cached"})
		if len(out) == 128 {
			break
		}
	}
	return out
}
func LinuxGateway(raw string) (string, string) {
	scanner := bufio.NewScanner(strings.NewReader(raw))
	for scanner.Scan() {
		f := strings.Fields(scanner.Text())
		if len(f) < 4 || f[1] != "00000000" {
			continue
		}
		n, e := strconv.ParseUint(f[2], 16, 32)
		flags, fe := strconv.ParseUint(f[3], 16, 32)
		if e == nil && fe == nil && flags&3 == 3 {
			return f[0], netip.AddrFrom4([4]byte{byte(n), byte(n >> 8), byte(n >> 16), byte(n >> 24)}).String()
		}
	}
	return "", ""
}
func DarwinGateway(raw string) (string, string) {
	name, gateway := "", ""
	for _, line := range strings.Split(raw, "\n") {
		f := strings.Fields(line)
		if len(f) == 2 && f[0] == "gateway:" {
			gateway = f[1]
		}
		if len(f) == 2 && f[0] == "interface:" {
			name = f[1]
		}
	}
	return name, gateway
}
func Supported() bool { return runtime.GOOS == "darwin" || runtime.GOOS == "linux" }
func Discover(ctx context.Context, cidrs []string) (Inventory, error) {
	out := Inventory{Interfaces: []Interface{}, Neighbors: []Neighbor{}}
	if err := ValidateScope(cidrs); err != nil {
		return out, err
	}
	if !Supported() {
		return out, errors.New("passive network adapter unavailable")
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var route, arp []byte
	var err error
	var name, gateway string
	if runtime.GOOS == "linux" {
		route, err = os.ReadFile("/proc/net/route")
		if err != nil {
			return out, errors.New("route metadata unavailable")
		}
		name, gateway = LinuxGateway(string(route))
		arp, err = os.ReadFile("/proc/net/arp")
	} else {
		route, err = exec.CommandContext(ctx, "/sbin/route", "-n", "get", "default").Output()
		if err == nil {
			name, gateway = DarwinGateway(string(route))
		}
		arp, err = exec.CommandContext(ctx, "/usr/sbin/arp", "-an").Output()
	}
	if err != nil {
		return out, errors.New("passive neighbor cache unavailable")
	}
	if len(arp) > 1<<20 || len(route) > 1<<20 {
		return out, errors.New("passive input limit")
	}
	ifaces, err := net.Interfaces()
	if err != nil {
		return out, errors.New("interface metadata unavailable")
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 || len(iface.Name) > 32 {
			continue
		}
		addresses, e := iface.Addrs()
		if e != nil {
			continue
		}
		for _, address := range addresses {
			p, e := netip.ParsePrefix(address.String())
			if e != nil || !Allowed(cidrs, p.Addr().String()) || p.Bits() > 30 {
				continue
			}
			var g *string
			if iface.Name == name && Allowed(cidrs, gateway) {
				value := gateway
				g = &value
			}
			out.Interfaces = append(out.Interfaces, Interface{iface.Name, p.String(), g})
			if len(out.Interfaces) == 16 {
				break
			}
		}
		if len(out.Interfaces) == 16 {
			break
		}
	}
	if len(out.Interfaces) == 0 {
		return out, errors.New("no in-scope local interface")
	}
	out.Neighbors = ParseARP(string(arp), runtime.GOOS == "linux", cidrs)
	return out, nil
}
