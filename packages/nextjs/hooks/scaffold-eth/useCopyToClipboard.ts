import { useState } from "react";

export const useCopyToClipboard = () => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 800);
      return true;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      // Fallback for older browsers
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const result = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (result) {
          setIsCopied(true);
          setTimeout(() => {
            setIsCopied(false);
          }, 800);
        }
        return result;
      } catch (fallbackError) {
        console.error("Fallback copy failed:", fallbackError);
        return false;
      }
    }
  };

  return { copyToClipboard, isCopied };
};
