"use client";

import { useState, useSyncExternalStore } from "react";
import { primaryButton } from "./ui";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const field =
  "w-full min-w-0 rounded-lg border border-marketing-border bg-white px-3 py-3 text-base text-[#30283c] placeholder:text-[#a090ab] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:text-sm";
const label =
  "flex min-w-0 flex-col gap-2 text-xs font-semibold text-marketing-label";

export function ContactForm() {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [status, setStatus] = useState("");
  return (
    <form
      id="contact-form"
      aria-labelledby="contact-form-title"
      aria-describedby="contact-delivery-note"
      className="scroll-mt-28 rounded-xl border border-marketing-border bg-white p-5 sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        setStatus(
          "Message delivery isn’t available yet. Your message has not been sent.",
        );
      }}
      onChange={() => setStatus("")}
    >
      <h2
        id="contact-form-title"
        className="font-[inherit] text-[25px] font-semibold leading-[1.3] tracking-[-.03em]"
      >
        What’s on your mind?
      </h2>
      <p className="mt-2 text-xs leading-[1.85] text-marketing-copy">
        Tell us a little about what you need.
      </p>
      {/* The pre-launch form has no delivery action. Keep it inert before hydration. */}
      <fieldset disabled={!ready} className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Your enquiry</legend>
        <div className="mt-7 grid gap-5 min-[851px]:grid-cols-2">
          <label className={label} htmlFor="contact-name">
            Your name
            <input
              id="contact-name"
              autoComplete="name"
              placeholder="Alex Morgan"
              required
              maxLength={100}
              pattern=".*\S.*"
              title="Enter your name."
              className={field}
            />
          </label>
          <label className={label} htmlFor="contact-email">
            Email address
            <input
              id="contact-email"
              type="email"
              autoComplete="email"
              placeholder="alex@example.com"
              required
              maxLength={254}
              className={field}
            />
          </label>
          <label
            className={`${label} min-[851px]:col-span-2`}
            htmlFor="contact-topic"
          >
            How can we help?
            <select
              id="contact-topic"
              required
              defaultValue=""
              className={`${field} min-h-[46px] font-normal`}
            >
              <option value="">Choose a topic</option>
              {[
                "Product question",
                "Help using NetSentry",
                "Business enquiry",
                "Feedback or an idea",
                "Privacy enquiry",
              ].map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>
          <div className="min-[851px]:col-span-2">
            <label className={label} htmlFor="contact-message">
              Your message
              <textarea
                id="contact-message"
                placeholder="A little context helps us understand your question…"
                required
                maxLength={5000}
                rows={5}
                className={`${field} min-h-[142px] resize-y font-normal`}
              />
            </label>
            <p className="mt-2 text-xs leading-[1.85] text-marketing-copy">
              Please leave out passwords and private device data.
            </p>
          </div>
        </div>
        <label
          htmlFor="contact-reply"
          className="my-6 flex min-h-11 items-start gap-3 text-[11px] leading-[1.8] text-marketing-copy"
        >
          <input
            id="contact-reply"
            type="checkbox"
            required
            className="mt-1 size-4 shrink-0 accent-[#806092]"
          />
          I’m happy to be contacted by email about this enquiry.
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <button className={primaryButton} type="submit">
            Send message
          </button>
          <p
            id="contact-delivery-note"
            className="text-[11px] leading-relaxed text-marketing-caption"
          >
            Preview · Messages aren’t sent.
          </p>
        </div>
      </fieldset>
      <noscript>
        <p className="mt-4 text-xs leading-relaxed text-[#705183]">
          This form preview needs JavaScript. Message delivery is not available
          yet; you can still browse the documentation.
        </p>
      </noscript>
      <p
        role="status"
        aria-live="polite"
        className="text-xs leading-[1.85] text-[#705183] [&:not(:empty)]:mt-4"
      >
        {status}
      </p>
    </form>
  );
}
