# WhatsApp Sales Chatbot SaaS

A fully autonomous, standalone Next.js 16 SaaS application that turns any WhatsApp number into an automated AI Sales Assistant using OpenAI and Baileys.

## Features

- **Instant WhatsApp Connection:** Link your WhatsApp account seamlessly via a beautifully designed QR code scanner without needing official WhatsApp Business APIs.
- **AI Sales Agent:** Utilizes OpenAI's GPT-4o-mini to interpret incoming messages and pitch your product perfectly.
- **Dynamic Bot Configuration:** Easily update the system prompt and product knowledge base in real-time from the dashboard.
- **Live Chat Logs:** Monitor ongoing AI-driven sales conversations directly from the dashboard in real-time.
- **Persistent Local Database:** Stores conversation history and configuration securely in a local JSON database so you don't lose context between restarts.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React, Tailwind CSS, Lucide React
- **Backend:** Next.js API Routes, `@whiskeysockets/baileys` (WhatsApp Web protocol)
- **AI Integration:** `openai` Node SDK

## Getting Started

### Prerequisites
- Node.js >= 18
- An OpenAI API Key

### Installation

1. Clone or navigate into the directory.
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root directory and add your OpenAI API Key:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. **Connect WhatsApp**: Click on the "Generate QR Code" button on the dashboard. Open WhatsApp on your phone -> Settings -> Linked Devices -> Link a Device, and scan the QR code.
2. **Configure the Bot**: Scroll down to the **Bot Configuration** panel. Enter the instructions for your AI agent and the product information you want it to sell. Click **Save Configuration**.
3. **Test the Bot**: Send a message from a different WhatsApp number to your connected phone. The AI agent will automatically process the message and reply!
4. **Monitor Chats**: Watch the conversation unfold in the **Live Chat Logs** panel on the dashboard.
