import { useState, useEffect } from 'react';
import { CredentialConfig, VisualElement } from '@/types/member';

const DEFAULT_CONFIG: CredentialConfig = {
  id: 'default',
  name: 'Plantilla Institucional',
  primaryColor: '#003366',
  secondaryColor: '#EAB308', // Yellow-500
  elements: [
    { id: '1', label: 'Nombre', field: 'fullName', type: 'text', x: 30, y: 15, fontSize: 10, fontWeight: 'black', color: '#003366', isVisible: true },
    { id: '2', label: 'Nómina', field: 'employeeId', type: 'text', x: 30, y: 22, fontSize: 8, fontWeight: 'bold', color: '#1F2937', isVisible: true },
    { id: '3', label: 'Puesto', field: 'position', type: 'text', x: 30, y: 28, fontSize: 8, fontWeight: 'bold', color: '#1F2937', isVisible: true },
    { id: '4', label: 'Socio', field: 'socioId', type: 'text', x: 5, y: 45, fontSize: 6, fontWeight: 'black', color: '#FFFFFF', isVisible: true },
    { id: '5', label: 'QR', field: 'id' as any, type: 'qr', x: 65, y: 35, fontSize: 36, fontWeight: 'normal', color: '#000000', isVisible: true },
    { id: '6', label: 'Tipo', field: 'memberType' as any, type: 'text', x: 30, y: 35, fontSize: 7, fontWeight: 'black', color: '#EAB308', isVisible: true },
  ]
};

export const useCredentialConfig = () => {
  const [config, setConfig] = useState<CredentialConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const saved = localStorage.getItem('credential_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.showTemplate = parsed.showTemplate !== false && parsed.showTemplate !== 0;
        // Map old field names to new ones if they exist in saved config
        parsed.elements = parsed.elements.map((el: any) => {
          if (el.field === 'payrollNumber') el.field = 'employeeId';
          if (el.field === 'memberNumber') el.field = 'socioId';
          return el;
        });
        setConfig(parsed);
      } catch (e) {
        console.error('Error loading config', e);
      }
    }
  }, []);

  const saveConfig = (newConfig: CredentialConfig) => {
    setConfig(newConfig);
    localStorage.setItem('credential_config', JSON.stringify(newConfig));
  };

  const updateElement = (id: string, updates: Partial<VisualElement>) => {
    const newElements = config.elements.map(el => el.id === id ? { ...el, ...updates } : el);
    saveConfig({ ...config, elements: newElements });
  };

  return { config, setConfig: saveConfig, updateElement };
};
