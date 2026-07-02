import React, { useState, useEffect, useRef } from 'react';

// Static array of major cities from all 28 States and major Union Territories of India
export const INDIAN_CITIES = [
  // Andhra Pradesh
  'Visakhapatnam, Andhra Pradesh', 'Vijayawada, Andhra Pradesh', 'Amaravati, Andhra Pradesh', 'Tirupati, Andhra Pradesh',
  // Arunachal Pradesh
  'Itanagar, Arunachal Pradesh',
  // Assam
  'Guwahati, Assam', 'Dispur, Assam', 'Dibrugarh, Assam',
  // Bihar
  'Patna, Bihar', 'Gaya, Bihar', 'Muzaffarpur, Bihar',
  // Chhattisgarh
  'Raipur, Chhattisgarh', 'Bhilai, Chhattisgarh',
  // Goa
  'Panaji, Goa', 'Margao, Goa',
  // Gujarat
  'Ahmedabad, Gujarat', 'Surat, Gujarat', 'Vadodara, Gujarat', 'Gandhinagar, Gujarat',
  // Haryana
  'Gurugram, Haryana', 'Faridabad, Haryana', 'Panipat, Haryana',
  // Himachal Pradesh
  'Shimla, Himachal Pradesh', 'Dharamshala, Himachal Pradesh',
  // Jharkhand
  'Ranchi, Jharkhand', 'Jamshedpur, Jharkhand', 'Dhanbad, Jharkhand',
  // Karnataka
  'Bengaluru, Karnataka', 'Mysuru, Karnataka', 'Hubli, Karnataka', 'Mangaluru, Karnataka',
  // Kerala
  'Kochi, Kerala', 'Thiruvananthapuram, Kerala', 'Kozhikode, Kerala',
  // Madhya Pradesh
  'Indore, Madhya Pradesh', 'Bhopal, Madhya Pradesh', 'Gwalior, Madhya Pradesh', 'Jabalpur, Madhya Pradesh',
  // Maharashtra
  'Mumbai, Maharashtra', 'Pune, Maharashtra', 'Nagpur, Maharashtra', 'Thane, Maharashtra', 'Nashik, Maharashtra',
  // Manipur
  'Imphal, Manipur',
  // Meghalaya
  'Shillong, Meghalaya',
  // Mizoram
  'Aizawl, Mizoram',
  // Nagaland
  'Kohima, Nagaland', 'Dimapur, Nagaland',
  // Odisha
  'Bhubaneswar, Odisha', 'Cuttack, Odisha', 'Rourkela, Odisha',
  // Punjab
  'Ludhiana, Punjab', 'Amritsar, Punjab', 'Jalandhar, Punjab', 'Patiala, Punjab',
  // Rajasthan
  'Jaipur, Rajasthan', 'Jodhpur, Rajasthan', 'Udaipur, Rajasthan', 'Kota, Rajasthan',
  // Sikkim
  'Gangtok, Sikkim',
  // Tamil Nadu
  'Chennai, Tamil Nadu', 'Coimbatore, Tamil Nadu', 'Madurai, Tamil Nadu', 'Salem, Tamil Nadu',
  // Telangana
  'Hyderabad, Telangana', 'Warangal, Telangana', 'Nizamabad, Telangana',
  // Tripura
  'Agartala, Tripura',
  // Uttar Pradesh
  'Lucknow, Uttar Pradesh', 'Noida, Uttar Pradesh', 'Kanpur, Uttar Pradesh', 'Varanasi, Uttar Pradesh', 'Ghaziabad, Uttar Pradesh', 'Agra, Uttar Pradesh',
  // Uttarakhand
  'Dehradun, Uttarakhand', 'Haridwar, Uttarakhand', 'Nainital, Uttarakhand',
  // West Bengal
  'Kolkata, West Bengal', 'Siliguri, West Bengal', 'Darjeeling, West Bengal', 'Howrah, West Bengal',
  // Union Territories
  'Delhi, Delhi UT', 'Srinagar, Jammu & Kashmir', 'Jammu, Jammu & Kashmir', 'Puducherry, Puducherry UT', 'Chandigarh, Chandigarh UT'
];

interface CityInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  required?: boolean;
  style?: React.CSSProperties;
}

export default function CityInput({ value, onChange, placeholder, required = false, style }: CityInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Update suggestions on input typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (val.trim().length >= 1) {
      const filtered = INDIAN_CITIES.filter((city) =>
        city.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6); // Limit suggestions to top 6 matches
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (city: string) => {
    onChange(city);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Close recommendations dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <input
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={value}
        required={required}
        onChange={handleInputChange}
        onFocus={() => {
          if (value.trim().length >= 1) {
            const filtered = INDIAN_CITIES.filter((city) =>
              city.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 6);
            setSuggestions(filtered);
            setShowSuggestions(true);
          }
        }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--border-radius-sm)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            listStyle: 'none',
            padding: 0,
            margin: '4px 0 0 0',
            zIndex: 300,
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {suggestions.map((city, idx) => (
            <li
              key={idx}
              onClick={() => handleSuggestionClick(city)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'white',
                borderBottom: idx !== suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(99, 102, 241, 0.2)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'transparent';
              }}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
