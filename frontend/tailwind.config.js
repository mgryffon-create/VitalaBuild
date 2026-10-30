/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['Inter', 'system-ui', 'sans-serif'],
  			heading: ['Montserrat', 'system-ui', 'sans-serif'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
            // Legacy accent utilities share the same warm brand scales.
            blue: {50:'#f5f7f1',100:'#e6ebdf',200:'#d1dcc5',300:'#b6c7a4',400:'#93ac7d',500:'#718b5e',600:'#536e44',700:'#3e5534',800:'#30432b',900:'#263623',950:'#141e12'},
            sky: {50:'#f5f7f1',100:'#e6ebdf',200:'#d1dcc5',300:'#b6c7a4',400:'#93ac7d',500:'#718b5e',600:'#536e44',700:'#3e5534',800:'#30432b',900:'#263623',950:'#141e12'},
            cyan: {50:'#f5f7f1',100:'#e6ebdf',200:'#d1dcc5',300:'#b6c7a4',400:'#93ac7d',500:'#718b5e',600:'#536e44',700:'#3e5534',800:'#30432b',900:'#263623',950:'#141e12'},
            teal: {50:'#f5f7f1',100:'#e6ebdf',200:'#d1dcc5',300:'#b6c7a4',400:'#93ac7d',500:'#718b5e',600:'#536e44',700:'#3e5534',800:'#30432b',900:'#263623',950:'#141e12'},
            purple: {50:'#fcf5ef',100:'#f1e4d8',200:'#e5cbb6',300:'#d5aa8c',400:'#c38964',500:'#ae704d',600:'#965b3d',700:'#7b4933',800:'#633d2d',900:'#513327',950:'#2b1913'},
            indigo: {50:'#fcf5ef',100:'#f1e4d8',200:'#e5cbb6',300:'#d5aa8c',400:'#c38964',500:'#ae704d',600:'#965b3d',700:'#7b4933',800:'#633d2d',900:'#513327',950:'#2b1913'},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};