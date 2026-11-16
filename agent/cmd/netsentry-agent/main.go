package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"netsentry.local/agent/internal/capability"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/localipc"
	"netsentry.local/agent/internal/modules/developer"
	"netsentry.local/agent/internal/modules/network"
	"netsentry.local/agent/internal/runner"
	"netsentry.local/agent/internal/securestore"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
)

func main() {
	if err := command(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "NetSentry agent:", err)
		os.Exit(1)
	}
}
func emit(value any) error { return json.NewEncoder(os.Stdout).Encode(value) }
func command(args []string) error {
	if len(args) == 0 || args[0] == "capabilities" {
		return emit(capability.Report{SchemaVersion: 1, Modules: []capability.Module{network.Capability(), developer.Capability()}})
	}
	if args[0] == "version" {
		return emit(map[string]string{"version": core.Version})
	}
	if args[0] == "verify-package" {
		return verifyCommand(args[1:])
	}
	defaults, err := core.DefaultDir()
	if err != nil {
		return errors.New("could not resolve application-state directory")
	}
	flags := flag.NewFlagSet(args[0], flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	stateDir := flags.String("state-dir", defaults, "")
	apiURL := flags.String("api", "", "")
	development := flags.Bool("development-store", false, "")
	codeFile := flags.String("code-file", "", "")
	once := flags.Bool("once", false, "")
	background := flags.Bool("background", false, "")
	noLocal := flags.Bool("no-local", false, "")
	networkEnabled := flags.Bool("network", false, "")
	developerEnabled := flags.Bool("developer", false, "")
	allowBackground := flags.Bool("allow-background", false, "")
	allowLocalControl := flags.Bool("allow-local-control", false, "")
	if flags.Parse(args[1:]) != nil || flags.NArg() != 0 {
		return errors.New("invalid command options; see agent/README.md")
	}
	dir, err := filepath.Abs(*stateDir)
	if err != nil {
		return err
	}
	if args[0] == "init" {
		config, err := core.Initialize(dir, *apiURL, *development)
		if err != nil {
			return err
		}
		initialized := false
		defer func() {
			if !initialized {
				os.Remove(filepath.Join(dir, "config.json"))
			}
		}()
		store, err := securestore.Open(dir, config)
		if err != nil {
			return err
		}
		secret, err := core.Secret()
		if err != nil {
			return err
		}
		if err := store.Set("ipc", secret); err != nil {
			return errors.New("could not store the local credential securely")
		}
		initialized = true
		return emit(map[string]any{"installationId": config.InstallationID, "stateDirectory": dir, "modules": config.Requested, "backgroundAllowed": false, "developmentStorage": config.DevelopmentStore})
	}
	config, err := core.LoadConfig(dir)
	if err != nil {
		return errors.New("could not load private agent configuration")
	}
	store, err := securestore.Open(dir, config)
	if err != nil {
		return err
	}
	if args[0] == "desktop-credential" {
		return credentialPipe(store)
	}
	if args[0] == "run" || args[0] == "pair" || args[0] == "unpair" || args[0] == "settings" || args[0] == "status" {
		unlock, err := core.Lock(dir)
		if err != nil {
			return err
		}
		defer unlock()
	}
	agent, err := runner.New(dir, config, store)
	if err != nil {
		return err
	}
	switch args[0] {
	case "settings":
		modules := config.Requested
		var bg *bool
		flags.Visit(func(option *flag.Flag) {
			switch option.Name {
			case "network":
				modules.Network = *networkEnabled
			case "developer":
				modules.Developer = *developerEnabled
			case "allow-background":
				bg = allowBackground
			}
		})
		var control *bool
		flags.Visit(func(option *flag.Flag) {
			if option.Name == "allow-local-control" {
				control = allowLocalControl
			}
		})
		if control != nil {
			if err := agent.LocalControl(*control); err != nil {
				return err
			}
		}
		if err := agent.Settings(&modules, bg); err != nil {
			return err
		}
		return emit(agent.Snapshot())
	case "pair":
		if _, err := os.Lstat(filepath.Join(dir, "agent.sock")); err == nil {
			return errors.New("pair through the desktop while the local agent is running")
		}
		if *codeFile == "" {
			return errors.New("supply a private --code-file; do not pass tokens as process arguments")
		}
		code, err := runner.ReadPairingCode(*codeFile)
		if err != nil {
			return err
		}
		if err := agent.Pair(context.Background(), strings.TrimSpace(code)); err != nil {
			return errors.New("pairing failed; check code, scope and backend availability")
		}
		return emit(agent.Snapshot())
	case "status":
		return emit(agent.Snapshot())
	case "unpair":
		if _, err := os.Lstat(filepath.Join(dir, "agent.sock")); err == nil {
			return errors.New("stop the foreground agent before unpairing")
		}
		if err := agent.Unpair(); err != nil {
			return err
		}
		return emit(agent.Snapshot())
	case "run":
		if *once {
			err := agent.Cycle(context.Background())
			if emitErr := emit(agent.Snapshot()); emitErr != nil {
				return emitErr
			}
			if err != nil {
				return errors.New("connection pass failed; inspect status code")
			}
			return nil
		}
		if *background && !config.BackgroundAllowed {
			return errors.New("background operation is not explicitly enabled")
		}
		ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer cancel()
		if *noLocal {
			return agent.Run(ctx, *background)
		}
		secret, err := store.Get("ipc")
		if err != nil {
			return errors.New("local credential is unavailable")
		}
		results := make(chan error, 2)
		go func() { results <- localipc.Serve(ctx, dir, secret, agent) }()
		go func() { results <- agent.Run(ctx, *background) }()
		err = <-results
		cancel()
		<-results
		return err
	default:
		return errors.New("unknown command; use init, pair, settings, run, status, unpair, capabilities, version or verify-package")
	}
}
