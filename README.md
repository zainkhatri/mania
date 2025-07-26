# Mania

Digital journaling without the pen in your hand.

## What is Mania?

Mania is a personal digital journaling app created by Zain that lets you create beautiful journal entries with images, text, and custom styling. Your entries are automatically saved as you type and can be exported as professional PDFs.

## Key Features

- **Auto-save** - Everything is saved as you type
- **Image uploads** - Add up to 3 images per entry
- **Smart color extraction** - Colors are automatically pulled from your images
- **PDF export** - Download your journals as beautiful PDFs
- **Clean design** - Elegant cream and black aesthetic
- **Works everywhere** - Fully responsive on all devices
- **AI-powered journal prompts** - Get thoughtful follow-up questions based on your journal entries

## How to Use

1. **Pick a date** for your journal entry
2. **Add a location** like "CHICAGO, ILLINOIS"
3. **Upload photos** that capture your memory
4. **Select colors** that complement your images
5. **Write your thoughts** - double line breaks create new paragraphs
6. **Export to PDF** whenever you're ready

## Setup

### OpenAI API Integration

This application uses the OpenAI API to generate personalized journal prompts:

1. Create an account on [OpenAI](https://openai.com) if you don't have one already
2. Get your API key from the [API keys page](https://platform.openai.com/account/api-keys)
3. Create a `.env` file in the root directory with the following content:
   ```
   REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
   ```
4. The app uses the `gpt-4o-mini` model for the best balance of quality and cost efficiency

## Tech Stack

Built with React, Firebase, OpenAI, and modern web technologies.

## About the Creator

This project was entirely created by Zain as a personal project. 

---

*© Zain - Create journals without the pen in your hand.*
