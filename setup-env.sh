#!/bin/bash

echo "Setting up environment for Mania Journal App..."
echo ""

# Check if .env file already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    echo "Current contents:"
    cat .env
    echo ""
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

echo "Please enter your OpenAI API key:"
read -s api_key

if [ -z "$api_key" ]; then
    echo "❌ No API key provided. Setup cancelled."
    exit 1
fi

# Create .env file
echo "REACT_APP_OPENAI_API_KEY=$api_key" > .env

echo "✅ .env file created successfully!"
echo "🔑 API key has been saved (first 10 characters: ${api_key:0:10}...)"
echo ""
echo "Next steps:"
echo "1. Restart your development server if it's running"
echo "2. The 'Roll for Inspiration' feature should now work with GPT AI"
echo "3. Your journal entries will generate targeted questions based on your content"
echo ""
echo "Note: Make sure to add .env to your .gitignore file to keep your API key secure!" 