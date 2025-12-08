'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { translations } from '@/lib/i18n';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState('en');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // Load initial language
        async function loadLanguage() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Try to fetch from profile
                const { data, error } = await supabase.from('users').select('language').eq('id', user.id).single();
                if (data?.language) {
                    setLanguageState(data.language);
                } else {
                    // If no profile row, create one (lazy init)
                    if (error && error.code === 'PGRST116') { // Row not found
                        await supabase.from('users').insert({ id: user.id, language: 'en' }).select();
                    }
                }
            }
            setLoaded(true);
        }
        loadLanguage();
    }, []);

    const setLanguage = async (lang) => {
        setLanguageState(lang);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Update profile
            const { error } = await supabase.from('users').upsert({ id: user.id, language: lang });
            if (error) console.error('Error updating language:', error);
        }
    };

    const t = useCallback((key) => {
        return translations[language]?.[key] || translations['en']?.[key] || key;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, loaded }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}
