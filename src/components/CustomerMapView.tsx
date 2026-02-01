import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";

interface Customer {
  id: string;
  full_name: string;
  latitude: number | null;
  longitude: number | null;
  mikrotik_users?: { username: string }[] | null;
}

interface CustomerMapViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
}

// Google Maps API Key - In future, this should come from Settings
const GOOGLE_MAPS_API_KEY = "AIzaSyC2gRj_VAVMekVbHKP8MJjMCK9vXk0gD-k";

interface GoogleMapsWindow extends Window {
  google?: {
    maps: {
      Map: new (element: HTMLElement, options: object) => GoogleMap;
      Marker: new (options: object) => GoogleMarker;
      InfoWindow: new () => GoogleInfoWindow;
      LatLngBounds: new () => GoogleLatLngBounds;
    };
  };
  initGoogleMaps?: () => void;
}

interface GoogleMap {
  fitBounds: (bounds: GoogleLatLngBounds) => void;
}

interface GoogleMarker {
  setMap: (map: GoogleMap | null) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  addListener: (event: string, callback: () => void) => void;
}

interface GoogleInfoWindow {
  setContent: (content: string) => void;
  open: (map: GoogleMap, marker: GoogleMarker) => void;
}

interface GoogleLatLngBounds {
  extend: (position: { lat: number; lng: number }) => void;
}

export function CustomerMapView({ open, onOpenChange, customers }: CustomerMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter customers with GPS data
  const customersWithGps = customers.filter(c => c.latitude && c.longitude);

  useEffect(() => {
    if (!open) return;

    const windowWithGoogle = window as GoogleMapsWindow;

    const loadGoogleMaps = () => {
      // Check if already loaded
      if (windowWithGoogle.google && windowWithGoogle.google.maps) {
        initMap();
        return;
      }

      // Check if script is already loading
      if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
        windowWithGoogle.initGoogleMaps = initMap;
        return;
      }

      // Load the script
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;
      windowWithGoogle.initGoogleMaps = initMap;
      script.onerror = () => {
        setError("Failed to load Google Maps. Please check your internet connection.");
        setLoading(false);
      };
      document.head.appendChild(script);
    };

    const initMap = () => {
      if (!mapRef.current || !windowWithGoogle.google) return;

      try {
        // Default center (Bangladesh)
        let center = { lat: 23.8103, lng: 90.4125 };
        
        // Use first customer's location if available
        if (customersWithGps.length > 0) {
          center = {
            lat: customersWithGps[0].latitude!,
            lng: customersWithGps[0].longitude!,
          };
        }

        const map = new windowWithGoogle.google.maps.Map(mapRef.current, {
          center,
          zoom: 12,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        mapInstanceRef.current = map;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        // Create info window
        const infoWindow = new windowWithGoogle.google.maps.InfoWindow();

        // Add markers for each customer with GPS
        customersWithGps.forEach(customer => {
          const pppoeUsername = customer.mikrotik_users?.[0]?.username || "N/A";
          
          const marker = new windowWithGoogle.google.maps.Marker({
            position: { lat: customer.latitude!, lng: customer.longitude! },
            map,
            title: customer.full_name,
            icon: {
              url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            },
          });

          marker.addListener("click", () => {
            infoWindow.setContent(`
              <div style="padding: 8px; min-width: 150px;">
                <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px;">${customer.full_name}</h3>
                <p style="margin: 0; color: #666; font-size: 12px; font-family: monospace;">PPPoE: ${pppoeUsername}</p>
                <a 
                  href="https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}" 
                  target="_blank" 
                  style="display: inline-block; margin-top: 8px; color: #1a73e8; font-size: 12px; text-decoration: none;"
                >
                  Get Directions →
                </a>
              </div>
            `);
            infoWindow.open(map, marker);
          });

          markersRef.current.push(marker);
        });

        // Fit bounds to show all markers
        if (markersRef.current.length > 1) {
          const bounds = new windowWithGoogle.google.maps.LatLngBounds();
          markersRef.current.forEach(marker => {
            const pos = marker.getPosition();
            if (pos) bounds.extend({ lat: pos.lat(), lng: pos.lng() });
          });
          map.fitBounds(bounds);
        }

        setLoading(false);
        setError(null);
      } catch (err) {
        console.error("Error initializing map:", err);
        setError("Failed to initialize map");
        setLoading(false);
      }
    };

    loadGoogleMaps();

    return () => {
      // Cleanup markers on unmount
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
    };
  }, [open, customersWithGps]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Customer Locations Map
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({customersWithGps.length} customers with GPS)
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 min-h-[400px] rounded-lg overflow-hidden border">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="text-center p-4">
                <p className="text-destructive mb-2">{error}</p>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {customersWithGps.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="text-center p-4">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No customers with GPS coordinates found</p>
              </div>
            </div>
          )}

          <div ref={mapRef} className="w-full h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
