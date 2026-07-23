import { useEffect, useRef, useState } from "react";
import type { Bot } from "@/lib/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ChevronDown } from "lucide-react";

interface BotPickerProps {
  bots: Bot[];
  selectedBot: Bot | null;
  onSelect: (bot: Bot) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export default function BotPicker({
  bots,
  selectedBot,
  onSelect,
  label = "Bot",
  placeholder = "Select a bot...",
  searchPlaceholder = "Search bots...",
  emptyMessage = "No bots found"
}: BotPickerProps) {
  const [botSearch, setBotSearch] = useState("");
  const [botPickerOpen, setBotPickerOpen] = useState(false);
  const botPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (botPickerRef.current && !botPickerRef.current.contains(e.target as Node)) {
        setBotPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBots = bots.filter((b) =>
    b.name.toLowerCase().includes(botSearch.toLowerCase())
  );

  function selectBot(bot: Bot) {
    onSelect(bot);
    setBotPickerOpen(false);
    setBotSearch("");
  }

  return (
    <div className="space-y-1.5">
      {label ? <label className="text-sm font-medium">{label}</label> : null}
      <div className="relative" ref={botPickerRef}>
        <button
          type="button"
          onClick={() => setBotPickerOpen(!botPickerOpen)}
          className="flex w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          {selectedBot ? (
            <>
              <Avatar className="size-6 rounded-sm" size="sm">
                {selectedBot.photoUrl ? (
                  <AvatarImage src={selectedBot.photoUrl} className="rounded-sm object-cover" />
                ) : null}
                <AvatarFallback className="rounded-sm text-[10px]">
                  {selectedBot.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-left">{selectedBot.name}</span>
              {selectedBot.status !== "ACTIVE" && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  {selectedBot.status}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="size-4 text-muted-foreground ml-auto" />
        </button>

        {botPickerOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={searchPlaceholder}
                value={botSearch}
                onValueChange={setBotSearch}
              />
              <CommandList>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {filteredBots.map((bot) => (
                    <CommandItem
                      key={bot.id}
                      value={bot.id}
                      onSelect={() => selectBot(bot)}
                      className="flex items-center gap-3"
                    >
                      <Avatar className="size-6 rounded-sm" size="sm">
                        {bot.photoUrl ? (
                          <AvatarImage src={bot.photoUrl} className="rounded-sm object-cover" />
                        ) : null}
                        <AvatarFallback className="rounded-sm text-[10px]">
                          {bot.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1">{bot.name}</span>
                      {bot.status !== "ACTIVE" && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          {bot.status}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </div>
    </div>
  );
}
