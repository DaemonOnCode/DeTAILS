package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"fmt"
	"io"

	"github.com/spf13/cobra"

	"github.com/ollama/ollama/cmd"

	"github.com/joho/godotenv"
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


func main() {

	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}
	cwd, err := os.Getwd()

	fmt.Println("Cwd: ", cwd)

	sourceFolder := filepath.Join(cwd, "llama", "make", "build", "darwin-arm64", "runners")
	destinationFolder := filepath.Join(cwd, "lib", "ollama", "runners")

	err = copyFolder(sourceFolder, destinationFolder)
	if err != nil {
		fmt.Printf("Error copying folder: %v\n", err)
	} else {
		fmt.Println("Folder copied successfully.")
	}

	fmt.Println("Starting Ollama CLI")
	fmt.Println(ResolvePath(os.Getenv("OLLAMA_TMPDIR")))
	fmt.Println(ResolvePath(os.Getenv("OLLAMA_LLM_LIBRARY")))

	cobra.CheckErr(cmd.NewCLI().ExecuteContext(context.Background()))
}
