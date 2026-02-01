import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, MapPin, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { decodeSettingValue } from "@/lib/settingsValue";

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
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const { toast } = useToast();

  // Filter customers with GPS data
  const customersWithGps = customers.filter(c => c.latitude && c.longitude);

  // Load API key from settings
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        // First try to get from system_settings (requires auth)
        const { data, error } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "google_maps_api_key")
          .single();
        
        if (!error && data?.value) {
          // Use decodeSettingValue to properly decode the stored value
          const decodedValue = decodeSettingValue(data.value);
          if (decodedValue && decodedValue !== 'null' && decodedValue.trim() !== '') {
            setApiKey(decodedValue);
            setLoading(false);
            return;
          }
        }
        
        // No API key found
        setLoading(false);
      } catch (err) {
        console.error("Error loading API key:", err);
        setLoading(false);
      }
    };
    
    if (open) {
      loadApiKey();
    }
  }, [open]);

  const saveApiKey = async () => {
    if (!tempApiKey.trim()) return;
    
    const { error } = await supabase
      .from("system_settings")
      .upsert({ 
        key: "google_maps_api_key", 
        value: tempApiKey.trim() 
      }, { onConflict: "key" });
    
    if (error) {
      toast({ title: "Error", description: "Failed to save API key", variant: "destructive" });
    } else {
      setApiKey(tempApiKey.trim());
      setShowApiKeyInput(false);
      toast({ title: "Success", description: "Google Maps API key saved" });
    }
  };

  useEffect(() => {
    if (!open || !apiKey) return;

    const windowWithGoogle = window as GoogleMapsWindow;

    const loadGoogleMaps = () => {
      // Check if already loaded with same key
      if (windowWithGoogle.google && windowWithGoogle.google.maps) {
        initMap();
        return;
      }

      // Remove any existing Google Maps script
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
      if (existingScript) {
        existingScript.remove();
      }

      // Load the script with async loading
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMaps&loading=async`;
      script.async = true;
      script.defer = true;
      windowWithGoogle.initGoogleMaps = initMap;
      script.onerror = () => {
        setError("Failed to load Google Maps. Please check your API key and internet connection.");
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
  }, [open, customersWithGps, apiKey]);

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
          <DialogDescription>
            View all customer locations on the map. Click a marker to see details.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex-1 min-h-[400px] rounded-lg overflow-hidden border">
          {!apiKey ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="text-center p-6 max-w-md">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Google Maps API Key Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please enter your Google Maps API key to display the map.
                </p>
                {showApiKeyInput ? (
                  <div className="space-y-3">
                    <div className="text-left">
                      <Label htmlFor="apiKey">API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        value={tempApiKey}
                        onChange={(e) => setTempApiKey(e.target.value)}
                        placeholder="Enter your Google Maps API key"
                      />
                    </div>
                    <div className="text-left text-xs text-muted-foreground mb-2 space-y-1">
                      <p><strong>Setup Instructions:</strong></p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a></li>
                        <li>Create or select a project</li>
                        <li>Enable "Maps JavaScript API"</li>
                        <li>Create an API key under Credentials</li>
                        <li>Add your domain to HTTP referrer restrictions</li>
                      </ol>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveApiKey} className="flex-1">Save</Button>
                      <Button variant="outline" onClick={() => setShowApiKeyInput(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setShowApiKeyInput(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configure API Key
                  </Button>
                )}
              </div>
            </div>
          ) : loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="text-center p-6 max-w-md">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive font-medium mb-2">{error}</p>
                <div className="text-xs text-muted-foreground mb-4 text-left bg-muted p-3 rounded">
                  <p className="font-medium mb-1">Common causes:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>ApiTargetBlockedMapError:</strong> Domain not allowed in API key restrictions</li>
                    <li><strong>Maps JavaScript API</strong> not enabled in Google Cloud Console</li>
                    <li><strong>Billing</strong> not enabled on Google Cloud project</li>
                  </ul>
                  <p className="mt-2">
                    <a href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Enable Maps API →
                    </a>
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => setShowApiKeyInput(true)}>
                    Update API Key
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          ) : customersWithGps.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="text-center p-4">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No customers with GPS coordinates found</p>
              </div>
            </div>
          ) : null}

          <div ref={mapRef} className="w-full h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
