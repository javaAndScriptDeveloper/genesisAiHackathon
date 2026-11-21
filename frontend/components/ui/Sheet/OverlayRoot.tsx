"use client";

import { createContext, useContext } from "react";

// Where overlays (Sheet) render. The phone frame provides its screen element so sheets always cover the visible
// screen, even when the page behind is scrolled. Without a provider (UI kit page) sheets render in place.
export const OverlayRootContext = createContext<HTMLElement | null>(null);
export const useOverlayRoot = () => useContext(OverlayRootContext);
