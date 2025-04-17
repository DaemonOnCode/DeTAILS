package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/joho/godotenv"
	"github.com/ollama/ollama/cmd"
	"github.com/spf13/cobra"
)

// copyFile copies a file from src to dst.
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destinationFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destinationFile.Close()

	_, err = io.Copy(destinationFile, sourceFile)
	return err
}

// copyFolder copies a folder from src to dst recursively.
func copyFolder(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Generate the corresponding path in the destination folder.
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		destPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			// Create directory in destination if it doesn't exist.
			err = os.MkdirAll(destPath, info.Mode())
			if err != nil {
				return err
			}
		} else {
			// Copy file to destination.
			err = copyFile(path, destPath)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

// ResolvePath resolves a relative path to an absolute path based on the current working directory.
func ResolvePath(relativePath string) string {
	// Get the current working directory
	workingDir, err := os.Getwd()
	if err != nil {
		log.Fatalf("Error getting working directory: %v", err)
	}

	// Join the working directory with the relative path
	absolutePath := filepath.Join(workingDir, relativePath)
	return absolutePath
}

// locateSourceFolder dynamically locates a suitable source folder based on OS and architecture.
func locateSourceFolder(cwd string) (string, error) {
	// Detect OS and architecture
	goos := runtime.GOOS
	goarch := runtime.GOARCH

	// Priority list of source folder patterns
	searchPatterns := []string{
		filepath.Join(cwd, "llama", "make", "build", fmt.Sprintf("%s-%s*", goos, goarch)), // Pattern for the current OS and architecture
		filepath.Join(cwd, "llama", "make", "build", "*"),                                 // Fallback for any build folder
	}

	// Search for matching source folders
	for _, pattern := range searchPatterns {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			return "", fmt.Errorf("error searching with pattern %s: %w", pattern, err)
		}
		if len(matches) > 0 {
			// Return the first matching folder
			return matches[0], nil
		}
	}

	return "", fmt.Errorf("no matching source folder found")
}

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	// Get current working directory
	cwd, err := os.Getwd()
	if err != nil {
		log.Fatalf("Error getting current working directory: %v", err)
	}
	fmt.Println("Cwd: ", cwd)

	// Locate the source folder dynamically
	sourceFolder, err := locateSourceFolder(cwd)
	if err != nil {
		fmt.Printf("Error locating source folder: %v", err)
	}
	fmt.Printf("Located source folder: %s\n", sourceFolder)

	// Set the destination folder
	destinationFolder := filepath.Join(cwd, "lib", "ollama")

	// Copy the source folder to the destination folder
	err = copyFolder(sourceFolder, destinationFolder)
	if err != nil {
		fmt.Printf("Error copying folder: %v\n", err)
	} else {
		fmt.Println("Folder copied successfully.")
	}

	// Debugging resolved paths
	fmt.Println("Starting Ollama CLI")
	fmt.Println(ResolvePath(os.Getenv("OLLAMA_TMPDIR")))
	fmt.Println(ResolvePath(os.Getenv("OLLAMA_LLM_LIBRARY")))

	// Execute the CLI command
	cobra.CheckErr(cmd.NewCLI().ExecuteContext(context.Background()))
}
