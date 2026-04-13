import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, X, Search } from "lucide-react";

// Top ~200 US cities for autocomplete — covers all major metros and state capitals
const US_CITIES = [
  "New York, NY","Los Angeles, CA","Chicago, IL","Houston, TX","Phoenix, AZ",
  "Philadelphia, PA","San Antonio, TX","San Diego, CA","Dallas, TX","San Jose, CA",
  "Austin, TX","Jacksonville, FL","Fort Worth, TX","Columbus, OH","Charlotte, NC",
  "Indianapolis, IN","San Francisco, CA","Seattle, WA","Denver, CO","Washington, DC",
  "Nashville, TN","Oklahoma City, OK","El Paso, TX","Boston, MA","Portland, OR",
  "Las Vegas, NV","Memphis, TN","Louisville, KY","Baltimore, MD","Milwaukee, WI",
  "Albuquerque, NM","Tucson, AZ","Fresno, CA","Mesa, AZ","Sacramento, CA",
  "Atlanta, GA","Kansas City, MO","Colorado Springs, CO","Omaha, NE","Raleigh, NC",
  "Virginia Beach, VA","Long Beach, CA","Miami, FL","Oakland, CA","Minneapolis, MN",
  "Tampa, FL","Tulsa, OK","Arlington, TX","New Orleans, LA","Wichita, KS",
  "Cleveland, OH","Bakersfield, CA","Aurora, CO","Anaheim, CA","Honolulu, HI",
  "Santa Ana, CA","Riverside, CA","Corpus Christi, TX","Lexington, KY","Pittsburgh, PA",
  "Anchorage, AK","Stockton, CA","Cincinnati, OH","Saint Paul, MN","Greensboro, NC",
  "Toledo, OH","Newark, NJ","Plano, TX","Henderson, NV","Lincoln, NE",
  "Orlando, FL","Jersey City, NJ","Chandler, AZ","St. Louis, MO","Buffalo, NY",
  "Norfolk, VA","Durham, NC","Madison, WI","Lubbock, TX","Irvine, CA",
  "Winston-Salem, NC","Glendale, AZ","Garland, TX","Hialeah, FL","Laredo, TX",
  "Reno, NV","Chesapeake, VA","Gilbert, AZ","Baton Rouge, LA","Irving, TX",
  "Scottsdale, AZ","North Las Vegas, NV","Fremont, CA","Boise, ID","Richmond, VA",
  "San Bernardino, CA","Birmingham, AL","Spokane, WA","Rochester, NY","Des Moines, IA",
  "Modesto, CA","Fayetteville, NC","Tacoma, WA","Oxnard, CA","Fontana, CA",
  "Moreno Valley, CA","Huntington Beach, CA","Glendale, CA","Salt Lake City, UT",
  "Worcester, MA","Little Rock, AR","Augusta, GA","Grand Rapids, MI","Tallahassee, FL",
  "Knoxville, TN","Amarillo, TX","Providence, RI","Mobile, AL","Huntsville, AL",
  "Chattanooga, TN","Savannah, GA","Charleston, SC","Greenville, SC","Columbia, SC",
  "Jackson, MS","Springfield, MO","Sioux Falls, SD","Boise City, ID","Topeka, KS",
  "Cheyenne, WY","Bismarck, ND","Pierre, SD","Concord, NH","Montpelier, VT",
  "Trenton, NJ","Dover, DE","Annapolis, MD","Harrisburg, PA","Albany, NY",
  "Hartford, CT","Lansing, MI","Springfield, IL","Jefferson City, MO","Frankfort, KY",
  "Salem, OR","Olympia, WA","Carson City, NV","Santa Fe, NM","Helena, MT",
  "Juneau, AK","St. Petersburg, FL","Fort Lauderdale, FL","Dayton, OH","Akron, OH",
  "Provo, UT","Shreveport, LA","Eugene, OR","Naperville, IL","Tempe, AZ",
  "Peoria, IL","Rockford, IL","Bridgeport, CT","Stamford, CT","New Haven, CT",
  "Paterson, NJ","Syracuse, NY","Yonkers, NY","Wilmington, DE","Wilmington, NC",
  "Ann Arbor, MI","Flint, MI","Beaumont, TX","Brownsville, TX","McAllen, TX",
  "Pasadena, TX","Killeen, TX","Midland, TX","Waco, TX","Abilene, TX",
];

/**
 * LocationAutocomplete — Searchable input that suggests US cities.
 * Saves structured "City, ST" values. Supports multiple locations as chips.
 */
const LocationAutocomplete = ({
  locations = [],
  onAdd,
  onRemove,
  placeholder = "Search city or state...",
  testId = "location-autocomplete",
}) => {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter suggestions
  const suggestions =
    query.length >= 2
      ? US_CITIES.filter(
          (city) =>
            city.toLowerCase().includes(query.toLowerCase()) &&
            !locations.includes(city)
        ).slice(0, 8)
      : [];

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query]);

  const selectCity = (city) => {
    onAdd(city);
    setQuery("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectCity(suggestions[highlightedIndex]);
      } else if (query.trim() && suggestions.length > 0) {
        selectCity(suggestions[0]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div data-testid={testId} className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          data-testid={`${testId}-input`}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          className="pl-9"
          autoComplete="off"
        />

        {/* Suggestion dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={listRef}
            data-testid={`${testId}-suggestions`}
            className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          >
            {suggestions.map((city, i) => (
              <button
                key={city}
                data-testid={`${testId}-suggestion-${i}`}
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  i === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50 text-foreground"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCity(city);
                }}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {city}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected locations as chips */}
      {locations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {locations.map((loc, index) => (
            <Badge
              key={`${loc}-${index}`}
              variant="outline"
              className="flex items-center gap-1 pr-1"
            >
              <MapPin className="w-3 h-3" />
              {loc}
              <button
                type="button"
                data-testid={`${testId}-remove-${index}`}
                onClick={() => onRemove(index)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
