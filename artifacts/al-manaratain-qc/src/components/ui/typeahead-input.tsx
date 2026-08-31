import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { filterTypeaheadOptions } from "./typeahead-options";

export interface TypeaheadInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  onCreateOption?: (value: string) => Promise<string | void> | string | void;
}

export function TypeaheadInput({
  value,
  onChange,
  options = [],
  placeholder = "Select or type...",
  emptyMessage = "No matches found.",
  className,
  onCreateOption,
}: TypeaheadInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const [showAllOptions, setShowAllOptions] = React.useState(false);
  const [isCreatingOption, setIsCreatingOption] = React.useState(false);

  // Sync internal input value with external value
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInputValue(newVal);
    setShowAllOptions(false);
    onChange(newVal);
    if (!open && newVal.length > 0) {
      setOpen(true);
    }
  };

  const filteredOptions = React.useMemo(
    () => showAllOptions ? options : filterTypeaheadOptions(options, inputValue),
    [options, inputValue, showAllOptions],
  );
  const trimmedInput = inputValue.trim();
  const hasExactMatch = options.some(
    (option) => option.trim().toLocaleLowerCase() === trimmedInput.toLocaleLowerCase(),
  );
  const canCreateOption = Boolean(onCreateOption && trimmedInput && !hasExactMatch);

  const handleCreateOption = async () => {
    if (!onCreateOption || !trimmedInput || hasExactMatch || isCreatingOption) return;
    setIsCreatingOption(true);
    try {
      const createdValue = await onCreateOption(trimmedInput);
      const nextValue = typeof createdValue === "string" && createdValue.trim()
        ? createdValue.trim()
        : trimmedInput;
      setInputValue(nextValue);
      onChange(nextValue);
      setShowAllOptions(false);
      setOpen(false);
    } catch {
      // The parent callback reports the specific creation error; keep the
      // typed value and menu available so the user can correct or retry.
    } finally {
      setIsCreatingOption(false);
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setShowAllOptions(false);
        }}
      >
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              onFocus={() => setOpen(true)}
              aria-autocomplete="list"
              aria-expanded={open}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full w-9 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
              onPointerDown={(event) => {
                event.preventDefault();
                setShowAllOptions(true);
                setOpen(true);
              }}
              onClick={() => {
                setShowAllOptions(true);
                setOpen(true);
              }}
              aria-label={`Show all ${placeholder.toLowerCase().replace("select or type", "").trim() || "options"}`}
            >
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {filteredOptions.length === 0 && !canCreateOption ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : (
                <>
                  {canCreateOption && (
                    <CommandGroup heading="Reference Data">
                      <CommandItem
                        value={`add-${trimmedInput}`}
                        onSelect={handleCreateOption}
                        disabled={isCreatingOption}
                      >
                        {isCreatingOption ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Add “{trimmedInput}” to Reference Data
                      </CommandItem>
                    </CommandGroup>
                  )}
                  {filteredOptions.length > 0 && (
                    <CommandGroup>
                      {filteredOptions.map((option) => (
                        <CommandItem
                          key={option}
                          value={option}
                          onSelect={() => {
                            setInputValue(option);
                            setShowAllOptions(false);
                            onChange(option);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value.toLowerCase() === option.toLowerCase()
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {option}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
