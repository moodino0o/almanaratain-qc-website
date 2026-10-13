import { useEffect } from "react";
import { handleEntryEnter } from "@/lib/enter-navigation";

export function useEnterNavigation() {
  useEffect(() => {
    // Document delegation also covers portalled dialogs and newly added table rows.
    document.addEventListener("keydown", handleEntryEnter);
    return () => document.removeEventListener("keydown", handleEntryEnter);
  }, []);
}
