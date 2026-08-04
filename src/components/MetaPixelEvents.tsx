"use client";

import { useEffect, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { useMetaPixel } from "@/components/MetaPixelProvider";
import type { MetaPixelParameters } from "@/lib/meta-pixel";

export type VehiclePixelData = {
  contentId: string;
  name: string;
  value: number;
  brand: string;
  model: string;
  year: number;
};

export function vehiclePixelParameters(vehicle: VehiclePixelData): MetaPixelParameters {
  return {
    content_ids: [vehicle.contentId],
    content_type: "product",
    content_name: vehicle.name,
    value: vehicle.value,
    currency: "BRL",
    marca: vehicle.brand,
    modelo: vehicle.model,
    ano: vehicle.year,
  };
}

export function VehicleViewContent({ vehicle }: { vehicle: VehiclePixelData }) {
  const { consent, track } = useMetaPixel();
  useEffect(() => {
    if (consent !== "accepted") return;
    const frame = window.requestAnimationFrame(() => {
      track("ViewContent", vehiclePixelParameters(vehicle));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [consent, track, vehicle]);
  return null;
}

type MetaTrackedAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  eventName: "Contact" | "Schedule" | "InitiateVehicleFinancing";
  eventParameters?: MetaPixelParameters;
  custom?: boolean;
};

export function MetaTrackedAnchor({ eventName, eventParameters = {}, custom = false, onClick, ...props }: MetaTrackedAnchorProps) {
  const { track } = useMetaPixel();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    track(eventName, eventParameters, custom);
    onClick?.(event);
  };
  return <a {...props} onClick={handleClick} />;
}
