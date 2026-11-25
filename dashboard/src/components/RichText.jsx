import { useEffect, useRef } from "react";
import { MdFormatBold, MdFormatItalic, MdFormatListBulleted, MdFormatListNumbered, MdLink, MdTitle, MdFormatClear } from "react-icons/md";

// Lightweight rich-text editor. Output is sanitized server-side before it is stored.
export default function RichText({ value, onChange, placeholder = "Describe the product…", invalid }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) ref.current.innerHTML = value || "";
  }, [value]);
  const cmd = (c, arg) => {
    ref.current?.focus();
    document.execCommand(c, false, arg);
    onChange(ref.current.innerHTML);
  };
  const tools = [
    [MdFormatBold, "Bold", () => cmd("bold")], [MdFormatItalic, "Italic", () => cmd("italic")],
    [MdTitle, "Heading", () => cmd("formatBlock", "h3")], [MdFormatListBulleted, "Bulleted list", () => cmd("insertUnorderedList")],
    [MdFormatListNumbered, "Numbered list", () => cmd("insertOrderedList")],
    [MdLink, "Link", () => { const u = prompt("Link URL (https://…)"); if (u && /^https?:\/\//.test(u)) cmd("createLink", u); }],
    [MdFormatClear, "Clear formatting", () => { cmd("removeFormat"); cmd("formatBlock", "p"); }],
  ];
  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100 ${invalid ? "border-red-400" : "border-gray-300"}`}>
      <div className="flex gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        {tools.map(([Icon, label, fn]) => (
          <button key={label} type="button" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={fn} className="rounded-md p-1.5 text-ink-soft hover:bg-white hover:text-ink">
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" data-placeholder={placeholder}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="prose-product min-h-40 px-4 py-3 text-sm outline-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]" />
    </div>
  );
}
