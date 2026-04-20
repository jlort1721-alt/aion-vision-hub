import { useEffect, useState } from "react";

export function SkipToMain() {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setIsKeyboardUser(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isKeyboardUser) return null;

  return (
    <a
      href="#main-content"
      className="fixed top-0 left-0 z-[100] -translate-y-full focus:translate-y-0 bg-primary text-primary-foreground px-4 py-2 text-sm font-medium transition-transform shadow-md"
    >
      Skip to main content
    </a>
  );
}
