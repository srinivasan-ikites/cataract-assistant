"""Page Object: Patient Portal - Chatbot/FAQ Overlay."""


class ChatbotPage:
    """Encapsulates the chatbot UI within the patient portal."""

    def __init__(self, page):
        self.page = page

    def wait_for_chatbot(self):
        """Wait for the chatbot to be ready."""
        self.page.get_by_placeholder("Ask a question...").wait_for(timeout=10000)

    def send_message(self, message: str):
        """Type a message and send it."""
        input_el = self.page.get_by_placeholder("Ask a question...")
        input_el.fill(message)
        # The send button becomes enabled after typing
        self.page.wait_for_timeout(300)
        input_el.press("Enter")

    def wait_for_response(self, timeout: int = 30000):
        """Wait for the chatbot to respond (new content appears)."""
        # Wait for the send button to become disabled (processing) then enabled again
        # Or just wait for new content to appear
        self.page.wait_for_timeout(2000)
        # Wait until the input is re-enabled (response complete)
        self.page.get_by_placeholder("Ask a question...").wait_for(
            state="visible", timeout=timeout
        )

    def get_last_response(self) -> str:
        """Get the text of the last chatbot response."""
        # Bot responses are inside generic containers with paragraphs
        # The chat area contains alternating user (paragraph) and bot (generic) messages
        # We look for the last substantial text block
        all_paragraphs = self.page.locator("p").all_text_contents()
        # Return the last non-empty paragraph that isn't a user message
        for text in reversed(all_paragraphs):
            if len(text) > 50:  # Bot responses are typically longer
                return text
        return ""

    def get_message_count(self) -> int:
        """Count suggestion buttons (proxy for message interaction)."""
        # Count suggestion buttons as a proxy
        return self.page.get_by_role("button").filter(has_text="Tell me").count()

    def has_suggestions(self) -> bool:
        """Check if follow-up suggestions are visible."""
        # Suggestions appear as buttons like "Tell me more.", "What are the risks?"
        suggestions = self.page.get_by_role("button").filter(has_text="Tell me")
        return suggestions.count() > 0 or self.page.get_by_role(
            "button"
        ).filter(has_text="What are the risks").count() > 0

    def close(self):
        """Close the chatbot overlay."""
        # Press Escape or click the close button in the chatbot header
        self.page.keyboard.press("Escape")
        self.page.wait_for_timeout(500)
