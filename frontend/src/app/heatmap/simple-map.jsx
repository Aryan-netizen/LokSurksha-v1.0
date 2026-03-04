'use client'

import React, { useRef, useEffect, useState } from "react";
import { Button } from '@/components/ui/button';

// Embedded config to avoid import issues
const MAPTILER_API_KEY = "h9EeWZpT7PxeWTwMGIo0";

export default function SimpleMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const center = { lng: 76.7794, lat: 30.7333 };
  const [zoom] = useState(9.79);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadMap = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const maptilersdk = await import("@maptiler/sdk");
        await import("@maptiler/sdk/dist/maptiler-sdk.css");
        
        if (map.current) return; // stops map from initializing more than once

        // Set MapTiler API key
        maptilersdk.config.apiKey = MAPTILER_API_KEY;
        console.log("API Key set:", MAPTILER_API_KEY);

        map.current = new maptilersdk.Map({
          container: mapContainer.current,
          style: maptilersdk.MapStyle.STREETS,
          center: [center.lng, center.lat],
          zoom: zoom
        });

        map.current.on("load", () => {
          console.log("Map loaded successfully");
          setMapLoaded(true);

          // Sample markers around Chandigarh (Sector 17 area)
          new maptilersdk.Marker({ color: "#FF0000" })
            .setLngLat([76.7810, 30.7415]) // Sector 17 Plaza
            .addTo(map.current);

          new maptilersdk.Marker({ color: "#00FF00" })
            .setLngLat([76.7792, 30.7402]) // Nearby commercial area
            .addTo(map.current);

          new maptilersdk.Marker({ color: "#0000FF" })
            .setLngLat([76.7824, 30.7423]) // Residential side
            .addTo(map.current);
        });

        map.current.on("error", (e) => {
          console.error("Map error:", e);
          setError("Map loading error: " + e.message);
        });

      } catch (error) {
        console.error("Error initializing map:", error);
        setError("Failed to initialize map: " + error.message);
      }
    };

    loadMap();
  }, [center.lng, center.lat, zoom]);

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Map Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Please check your MapTiler API key and internet connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="w-full h-full bg-gray-200" />
      
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Status Panel */}
      <div className="absolute top-4 right-4 z-10 bg-white p-4 rounded-lg shadow-lg">
        <h3 className="font-semibold mb-2 text-sm">Map Status</h3>
        <p className="text-xs text-gray-600">
          Status: <span className="font-semibold">{mapLoaded ? "Loaded" : "Loading..."}</span>
        </p>
        <p className="text-xs text-gray-600">
          API Key: <span className="font-semibold">{MAPTILER_API_KEY ? "Set" : "Missing"}</span>
        </p>
      </div>

      {/* Legend for Chandigarh */}
      <div className="absolute bottom-4 left-4 z-10 bg-white p-4 rounded-lg shadow-lg">
        <h3 className="font-semibold mb-2 text-sm">Chandigarh Crime Markers</h3>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-xs">Sector 17 (High Activity)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-xs">Sector 22 (Medium Activity)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-xs">Industrial Area (Low Activity)</span>
          </div>
        </div>
      </div>
    </div>
  );
}