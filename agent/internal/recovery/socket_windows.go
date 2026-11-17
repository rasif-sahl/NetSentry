//go:build windows

package recovery

func Socket(string, bool) string { return "PLATFORM_UNSUPPORTED" }
