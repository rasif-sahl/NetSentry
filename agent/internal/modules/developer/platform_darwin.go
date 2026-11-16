//go:build darwin && cgo

package developer

/*
#include <libproc.h>
#include <sys/proc_info.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <signal.h>
#include <unistd.h>
#include <errno.h>
#include <sys/time.h>
#include <dlfcn.h>
#include <string.h>
// ABI binding for Apple's PROC_PIDUNIQIDENTIFIERINFO (17). The published XNU
// layout is 56 bytes; an unavailable/mismatching query disables control.
// https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info_private.h
struct ns_unique { unsigned char uuid[16]; uint64_t unique,parent; int32_t version,parent_version; uint64_t reserved[2]; };
_Static_assert(sizeof(struct ns_unique)==56,"process identity ABI");
struct ns_process { int pid,ppid,uid,privileged; uint32_t version; uint64_t sec,usec; char executable[PROC_PIDPATHINFO_MAXSIZE]; char cwd[1024]; };
struct ns_endpoint { char address[INET6_ADDRSTRLEN]; int port; uint64_t generation; };
typedef int (*ns_signal_fn)(audit_token_t *,int);
static int ns_inspect(int,struct ns_process *);
static int ns_supported(void) { struct ns_process p; return getuid()!=0&&dlsym(RTLD_DEFAULT,"proc_signal_with_audittoken")!=NULL&&ns_inspect(getpid(),&p)==0; }
static int ns_inspect(int pid,struct ns_process *out) {
 struct proc_bsdinfo b; struct ns_unique a,z; memset(out,0,sizeof(*out));
 errno=0;if(proc_pidinfo(pid,17,0,&a,sizeof(a))!=sizeof(a))return errno==ESRCH?ESRCH:EPERM;
 errno=0;if(proc_pidinfo(pid,PROC_PIDTBSDINFO,0,&b,sizeof(b))!=sizeof(b))return errno==ESRCH?ESRCH:EPERM;if(b.pbi_status==5)return ESRCH;
 if(b.pbi_uid!=getuid()||b.pbi_ruid!=getuid()||b.pbi_svuid!=getuid())return EPERM;
 out->pid=pid;out->ppid=b.pbi_ppid;out->uid=b.pbi_uid;out->version=a.version;
 out->sec=b.pbi_start_tvsec;out->usec=b.pbi_start_tvusec;out->privileged=(b.pbi_flags&(PROC_FLAG_SYSTEM|PROC_FLAG_PSUGID))!=0;
 if(proc_pidpath(pid,out->executable,sizeof(out->executable))<=0)return EPERM;
 struct proc_vnodepathinfo v; if(proc_pidinfo(pid,PROC_PIDVNODEPATHINFO,0,&v,sizeof(v))==sizeof(v))strlcpy(out->cwd,v.pvi_cdir.vip_path,sizeof(out->cwd));
 errno=0;if(proc_pidinfo(pid,17,0,&z,sizeof(z))!=sizeof(z))return errno==ESRCH?ESRCH:EPERM;if(a.version!=z.version||a.unique!=z.unique)return ESRCH;
 return 0;
}
static int ns_listeners(int pid,struct ns_endpoint *out,int capacity) {
 struct proc_fdinfo fds[2048]; int bytes=proc_pidinfo(pid,PROC_PIDLISTFDS,0,fds,sizeof(fds));
 if(bytes<=0)return -1; if(bytes>=sizeof(fds))return -2;
 int count=0;
 for(int i=0;i<bytes/sizeof(struct proc_fdinfo);i++) {
  if(fds[i].proc_fdtype!=PROX_FDTYPE_SOCKET)continue;
  struct socket_fdinfo s; if(proc_pidfdinfo(pid,fds[i].proc_fd,PROC_PIDFDSOCKETINFO,&s,sizeof(s))!=sizeof(s))continue;
  if(s.psi.soi_kind!=SOCKINFO_TCP||s.psi.soi_proto.pri_tcp.tcpsi_state!=TSI_S_LISTEN)continue;
  if(count>=capacity)return -2;
  struct in_sockinfo *in=&s.psi.soi_proto.pri_tcp.tcpsi_ini;
  const void *address=NULL;int family=0;
  if(s.psi.soi_family==AF_INET6&&(in->insi_vflag&INI_IPV6)){family=AF_INET6;address=&in->insi_laddr.ina_6;}
  else if(in->insi_vflag&INI_IPV4){family=AF_INET;address=&in->insi_laddr.ina_46.i46a_addr4;}
  if(!address||!inet_ntop(family,address,out[count].address,sizeof(out[count].address)))continue;
  out[count].generation=in->insi_gencnt;out[count].port=ntohs((uint16_t)in->insi_lport);count++;
 }
 return count;
}
static int ns_signal(int pid,uint32_t version,int sig,int64_t before) {
 ns_signal_fn fn=(ns_signal_fn)dlsym(RTLD_DEFAULT,"proc_signal_with_audittoken");if(!fn)return ENOTSUP;
 audit_token_t token={{0}};token.val[5]=pid;token.val[7]=version;
 struct timeval now;if(before>0){gettimeofday(&now,NULL);if((int64_t)now.tv_sec*1000+now.tv_usec/1000>=before)return ETIMEDOUT;}
 return fn(&token,sig);
}
*/
import "C"
import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"
	"time"
	"unsafe"
)

type native struct{}

func Native() Adapter          { return native{} }
func (native) Supported() bool { return C.ns_supported() != 0 }
func (native) Inspect(pid int) (Process, error) {
	var value C.struct_ns_process
	code := C.ns_inspect(C.int(pid), &value)
	if code != 0 {
		if code == C.EPERM {
			return Process{}, ErrDenied
		}
		return Process{}, ErrGone
	}
	return Process{PID: int(value.pid), ParentPID: int(value.ppid), UID: int(value.uid), Version: uint32(value.version), Started: time.Unix(int64(value.sec), int64(value.usec)*1000), Executable: C.GoString(&value.executable[0]), Directory: C.GoString(&value.cwd[0]), Privileged: value.privileged != 0}, nil
}
func (n native) Processes(ctx context.Context) ([]Process, error) {
	pids := make([]C.int, 8192)
	bytes := C.proc_listpids(C.PROC_UID_ONLY, C.uint32_t(os.Getuid()), unsafe.Pointer(&pids[0]), C.int(len(pids)*4))
	if bytes <= 0 || int(bytes) >= len(pids)*4 {
		return nil, errors.New("process inventory unavailable or truncated")
	}
	result := []Process{}
	for _, pid := range pids[:int(bytes)/4] {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if pid <= 1 {
			continue
		}
		if p, err := n.Inspect(int(pid)); err == nil {
			result = append(result, p)
		}
	}
	return result, nil
}
func (n native) Listeners(ctx context.Context, p Process) ([]Endpoint, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	var values [64]C.struct_ns_endpoint
	count := C.ns_listeners(C.int(p.PID), &values[0], 64)
	if count < 0 {
		return nil, ErrDenied
	}
	current, err := n.Inspect(p.PID)
	if err != nil || !same(current, p) {
		return nil, ErrGone
	}
	unique := map[Endpoint]bool{}
	result := []Endpoint{}
	for _, value := range values[:int(count)] {
		e := Endpoint{Address: C.GoString(&value.address[0]), Port: int(value.port), SocketID: identifier(fmt.Sprint(uint64(value.generation)))}
		if e.Port > 0 && !unique[e] {
			unique[e] = true
			result = append(result, e)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Port == result[j].Port {
			return result[i].Address < result[j].Address
		}
		return result[i].Port < result[j].Port
	})
	return result, nil
}
func (n native) Signal(p Process, force bool) error { return n.SignalBefore(p, force, time.Time{}) }
func (n native) SignalBefore(p Process, force bool, before time.Time) error {
	if p.PID <= 1 || p.PID == os.Getpid() || p.UID != os.Getuid() || p.Privileged || p.Version == 0 {
		return ErrDenied
	}
	current, err := n.Inspect(p.PID)
	if err != nil {
		return err
	}
	if !same(current, p) {
		return ErrGone
	}
	sig := C.int(C.SIGTERM)
	if force {
		sig = C.SIGKILL
	}
	limit := int64(0)
	if !before.IsZero() {
		limit = before.UnixMilli()
	}
	code := C.ns_signal(C.int(p.PID), C.uint32_t(p.Version), sig, C.int64_t(limit))
	if code == 0 {
		return nil
	}
	if code == C.ETIMEDOUT {
		return ErrExpired
	}
	if code == C.ESRCH {
		return ErrGone
	}
	if code == C.ENOTSUP {
		return ErrUnsupported
	}
	return ErrDenied
}
