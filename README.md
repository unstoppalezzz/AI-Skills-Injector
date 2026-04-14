# AI Skills Injector 

**AI Skills Injector** is a powerful, lightweight userscript designed to streamline your interactions across multiple AI platforms including ChatGPT, Google Gemini, and Duck.ai. 

Stop copy-pasting your frequent system instructions. This tool lets you build a "Skill Library" that you can inject into any conversation with a single click.

---

##  Features

* **Multi-Platform:** Fully compatible with ChatGPT, Gemini, and Duck.ai.
* **Draggable Widget:** Click and hold the header to move the skill panel anywhere on your screen.
* **Markdown Support:** Skills fully support Markdown formatting for complex instructions.
* **Drag-and-Drop Reordering:** Use "Manage" mode to reorder your skills via a simple drag handle.
* **Persistent Storage:** Your library is saved locally in your browser and persists through updates.

---

## 🛠️ Installation

**[Tampermonkey](https://www.tampermonkey.net/)**.

1.  **Install Tampermonkey** for your preferred browser.
2.  **One-Click Install:** Click the badge below to open the installation page:
    
    [![Install Skill Injector](https://github.com/unstoppalezzz/AI-Skills-Injector/raw/refs/heads/main/Skills%20Injector.user.js)]

3.  Click **Install** in the Tampermonkey tab that opens.
4.  Refresh your AI chat page to see the new skill panel.

---

## 📝 Markdown Support

The injector preserves all Markdown formatting within your skills. You can include:
* **Bold** and *Italic* text.
* Bulleted or numbered lists.
* `Inline code` or ```code blocks```.
* Headers (#, ##, etc.) to structure complex system prompts.

When injected, the AI will receive the Markdown exactly as written, ensuring your prompt engineering remains precise and structured.

---

##  Import & Export

Managing your prompt library is simple and flexible:

* **Export JSON:** Click the **Export JSON** button to download your entire library as a file. This is perfect for backing up your prompts or moving them to a different browser/computer.
* **Import JSON:** Have a pre-made list? Use the **Import from JSON** option to load a `.json` file.
* **From URL:** Point the injector to a raw JSON URL (for example, a GitHub Gist) to fetch and append skills remotely — note: the project's GitHub repository includes a skills folder with ready‑to‑use skill txt files.
* **Paste:** Quickly add a new skill by pasting raw text or a JSON object directly.

---

##  How to Use

1.  **Select a Skill:** Click any skill button in the panel. It will turn **blue** to indicate it is active.
2.  **Type Your Message:** Write your prompt or paste your data into the chat box as usual.
3.  **Send:** Hit "Enter" or click the send icon. The script will automatically prepend your skill instruction and wrap your message in quotes.
4.  **Manage:** Click "Manage" to reorder skills or delete ones you no longer need.

---

##  Contributing

Contributions are welcome! If you find a bug or have a feature request, feel free to open an issue or submit a pull request.

---

##  License

Distributed under the **Gpl-3.0 License**. See `LICENSE` for more information.
