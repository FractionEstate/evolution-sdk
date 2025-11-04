#!/bin/bash

# Script to run all TypeScript examples and generate MDX documentation
# This ensures examples are working before generating documentation

set -e  # Exit on any error

DOCS_DIR="$(dirname "$(dirname "$0")")"
EXAMPLES_DIR="$DOCS_DIR/examples"
SCRIPTS_DIR="$DOCS_DIR/scripts"

echo "🚀 Running Evolution SDK Documentation Generator"
echo "==============================================="

# Function to check if a file has a skip tag
has_skip_tag() {
    local file="$1"
    # Check for @skip-check: comment in the first 5 lines
    head -n 5 "$file" | grep -q "@skip-check:" && return 0 || return 1
}

# Function to extract skip reason from file
get_skip_reason() {
    local file="$1"
    # Extract the reason after @skip-check:
    head -n 5 "$file" | grep "@skip-check:" | sed 's/.*@skip-check://' | tr -d ' */'
}

# Function to run a single TypeScript file
run_example() {
    local file="$1"
    local relative_path="${file#$EXAMPLES_DIR/}"
    
    # Check if file should be skipped
    if has_skip_tag "$file"; then
        local skip_reason=$(get_skip_reason "$file")
        echo "⏭️  Skipping: $relative_path ($skip_reason)"
        return 0  # Return success to not block the build
    fi
    
    echo "📄 Running: $relative_path"
    
    # Use pnpm exec to ensure we have access to workspace dependencies
    if ! pnpm exec tsx "$file"; then
        echo "❌ Failed to run: $relative_path"
        return 1
    else
        echo "✅ Success: $relative_path"
        return 0
    fi
}

# Function to run examples found by a recursive find
run_examples_recursive() {
    local root="$1"
    local failures=0
    echo ""
    echo "📁 Running all examples under: ${root#$EXAMPLES_DIR/} (recursively)"
    echo "----------------------------------------------------------------"

    # Find all .ts and .tsx files recursively
    while IFS= read -r -d '' file; do
        if ! run_example "$file"; then
            ((failures++))
        fi
    done < <(find "$root" -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | sort -z)

    if [[ $failures -gt 0 ]]; then
        echo "❌ $failures example(s) failed under ${root#$EXAMPLES_DIR/}"
        return 1
    else
        echo "✅ All examples passed under ${root#$EXAMPLES_DIR/}"
        return 0
    fi
}

# Main execution
main() {
    local total_failures=0
    
    # Change to docs directory
    cd "$DOCS_DIR"

    # Note: do not build docs here; just run examples then the generator
    
    # Run all examples recursively under examples/ (includes nested folders)
    if [[ -d "$EXAMPLES_DIR" ]]; then
        if ! run_examples_recursive "$EXAMPLES_DIR"; then
            ((total_failures++))
        fi
    else
        echo "ℹ️  No examples directory found"
    fi
    
    echo ""
    echo "📊 Test Summary"
    echo "==============="
    
    if [[ $total_failures -eq 0 ]]; then
        echo "✅ All examples ran successfully!"
        echo ""
        echo "🔄 Generating MDX documentation..."
        echo "--------------------------------"

        # Run the snippet generation script (new generator)
        if pnpm exec tsx "scripts/generate-mdx-examples.ts"; then
            echo "✅ MDX documentation generated successfully!"
            echo ""
            echo "🎉 Documentation build complete!"
            echo "You can now run 'pnpm run dev' to view the documentation."
        else
            echo "❌ Failed to generate MDX documentation"
            exit 1
        fi
    else
        echo "❌ $total_failures example(s) failed"
        echo "Please fix the failing examples before generating documentation."
        exit 1
    fi
}

# Handle script interruption
trap 'echo ""; echo "⚠️  Script interrupted"; exit 130' INT

# Run main function
main "$@"