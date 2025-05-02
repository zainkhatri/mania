# OpenAI Integration Setup

This guide will help you set up the OpenAI integration for journal prompts in the application.

## Creating an OpenAI Account

1. Visit [OpenAI's website](https://openai.com) and sign up for an account if you don't already have one
2. After creating an account, navigate to the [API section](https://platform.openai.com/api-keys)

## Getting Your API Key

1. In the OpenAI platform, go to the API Keys section
2. Click on "Create new secret key"
3. Give your key a name (e.g., "Journal App")
4. Copy the key immediately - you won't be able to see it again!

## Setting Up the App

1. Create a `.env` file in the root directory of your project (same level as package.json)
2. Add the following line to the file:
   ```
   REACT_APP_CHATGPTAPI=your_api_key_here
   ```
3. Replace "your_api_key_here" with the API key you copied
4. Save the file

## Usage and Cost Efficiency

The app uses the `gpt-4o-mini` model, which offers a good balance between quality and cost:

- Input tokens: $0.15 per 1M tokens
- Output tokens: $0.60 per 1M tokens

With a $10 credit, you can generate approximately:
- 66,000 input tokens (roughly 50,000 words of your journal entries)
- 16,000 output tokens (about 12,000 words of AI responses)

## Testing the Integration

1. Start the application with `npm start`
2. Create a journal entry with some text
3. You should see an "Enhance with AI" button that generates follow-up questions
4. If the integration is working, you'll get personalized questions based on your journal content

## Troubleshooting

If you encounter issues:

1. Make sure your `.env` file is in the correct location
2. Check that the variable name is exactly `REACT_APP_CHATGPTAPI`
3. Verify your API key is valid
4. Restart the application after making changes to the `.env` file

## Privacy Considerations

Your journal entries are sent to OpenAI for processing. While OpenAI has privacy measures in place, you should be aware that:

1. Your journal content will be processed on OpenAI's servers
2. OpenAI's [privacy policy](https://openai.com/privacy/) applies to this data
3. Consider avoiding highly sensitive personal information in journals where you use the AI enhancement feature

For more information, consult the [OpenAI documentation](https://platform.openai.com/docs/introduction). 