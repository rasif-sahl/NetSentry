package developer

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
)

type Project struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Source     string `json:"source"`
	Confidence string `json:"confidence"`
	Evidence   string `json:"evidence"`
}

func identifier(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func inferProject(directory string) (Project, string) {
	if directory == "" || !filepath.IsAbs(directory) {
		return Project{ID: identifier("unknown"), Name: "Unknown project", Source: "unknown", Confidence: "unknown", Evidence: "Working directory unavailable"}, "unknown"
	}
	start := filepath.Clean(directory)
	for current, depth := start, 0; depth < 12; depth++ {
		for _, marker := range []string{"package.json", "go.mod", "pyproject.toml", "Cargo.toml", "Gemfile", "pom.xml", "composer.json", ".git"} {
			info, err := os.Lstat(filepath.Join(current, marker))
			if err != nil || info.Mode()&os.ModeSymlink != 0 {
				continue
			}
			if (marker == ".git" && info.IsDir()) || info.Mode().IsRegular() {
				return Project{ID: identifier(current), Name: display(filepath.Base(current)), Source: "inferred", Confidence: "inferred", Evidence: "Nearest ancestor contains " + marker}, current
			}
		}
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		current = parent
	}
	return Project{ID: identifier(start), Name: display(filepath.Base(start)), Source: "directory", Confidence: "uncertain", Evidence: "Working directory only; no project marker found"}, start
}
func display(value string) string {
	result := strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, value)
	runes := []rune(result)
	if len(runes) > 100 {
		result = string(runes[:100])
	}
	if result == "" {
		return "Unnamed project"
	}
	return result
}
func runtimeName(path string) string {
	name := strings.ToLower(filepath.Base(path))
	switch {
	case name == "node" || name == "nodejs":
		return "Node.js"
	case strings.HasPrefix(name, "python3") || name == "python":
		return "Python"
	case name == "bun":
		return "Bun"
	case name == "deno":
		return "Deno"
	case name == "ruby":
		return "Ruby"
	case name == "php":
		return "PHP"
	case name == "java":
		return "Java"
	default:
		return "unknown"
	}
}
