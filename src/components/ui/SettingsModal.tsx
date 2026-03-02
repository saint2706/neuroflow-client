import React, { useState, useEffect } from 'react';
import { MdClose, MdFontDownload } from 'react-icons/md';
import { useAppStore } from '../../store/useAppStore';
import { Button } from './button';
import { Input } from './input';

const PREDEFINED_FONTS = [
    { label: 'System Default', value: "'Inter', system-ui, sans-serif" },
    { label: 'Comic Sans MS', value: "'Comic Sans MS', 'Comic Sans', cursive" },
    { label: 'Roboto', value: "'Roboto', sans-serif" },
    { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" }
];

const SettingsModal = () => {
    const { isSettingsModalOpen, setIsSettingsModalOpen, appFont, setAppFont } = useAppStore();
    const [customFont, setCustomFont] = useState('');

    useEffect(() => {
        // Find if current appFont is NOT in the predefined list
        const isPredefined = PREDEFINED_FONTS.some(f => f.value === appFont);
        if (!isPredefined) {
            // Strip out quotes/fallbacks to show in input
            const fontName = appFont.split(',')[0].replace(/['"]/g, '').trim();
            setCustomFont(fontName);
        } else {
            setCustomFont('');
        }
    }, [appFont, isSettingsModalOpen]);

    if (!isSettingsModalOpen) return null;

    const handleApplyCustomFont = () => {
        if (!customFont.trim()) return;
        // Construct standard fallback for typical system usage
        setAppFont(`'${customFont.trim()}', sans-serif`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-semibold text-gray-800">Application Settings</h2>
                    <Button variant="ghost" size="icon" onClick={() => setIsSettingsModalOpen(false)} className="h-8 w-8 text-gray-500 hover:text-gray-800">
                        <MdClose className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-6">
                    {/* Predefined Fonts */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-700">Typography Theme</h3>
                        <div className="grid gap-2">
                            {PREDEFINED_FONTS.map(font => (
                                <button
                                    key={font.value}
                                    onClick={() => setAppFont(font.value)}
                                    className={`flex items-center justify-between p-3 border rounded-lg transition-all ${appFont === font.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                                >
                                    <span style={{ fontFamily: font.value }} className="text-gray-800 text-sm">{font.label}</span>
                                    {appFont === font.value && (
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Google Font */}
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <div className="space-y-1">
                            <h3 className="text-sm font-medium text-gray-700">Custom Google Font</h3>
                            <p className="text-xs text-gray-500">Enter exactly as it appears on Google Fonts.</p>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={customFont}
                                onChange={(e) => setCustomFont(e.target.value)}
                                placeholder="e.g. Pacifico, Playfair Display"
                                className="flex-1"
                                onKeyDown={e => e.key === 'Enter' && handleApplyCustomFont()}
                            />
                            <Button onClick={handleApplyCustomFont} variant="outline" className="gap-1.5 whitespace-nowrap">
                                <MdFontDownload className="h-4 w-4" /> Load
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
