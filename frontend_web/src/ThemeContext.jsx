import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        // Try to read the theme from localStorage
        const savedTheme = localStorage.getItem('mutuals_theme');
        return savedTheme || 'dark'; // Default to dark
    });

    useEffect(() => {
        // Apply the theme to the body data attribute
        document.body.setAttribute('data-theme', theme);
        // Save to localStorage
        localStorage.setItem('mutuals_theme', theme);

        // Add a class for transitions so it doesn't jump aggressively on load
        document.body.classList.add('theme-transitioning');
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, 500);

    }, [theme]);

    const changeTheme = (newTheme) => {
        setTheme(newTheme);
    };

    const value = {
        theme,
        changeTheme,
        themes: ['dark', 'light', 'cyberpunk', 'minimal']
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
