// FormBuilder i18n translations
// Default language: English (en)
// Supported languages: English (en), Spanish Argentina (es-AR)

export const translations = {
  en: {
    // FormBuilder main component
    formBuilder: {
      update: 'Update',
      create: 'Create',
      cancel: 'Cancel',
      sending: 'Sending...',
      configError: 'Configuration Error',
      schemaRequired: 'The schema parameter is required',
      noFields: 'No fields to display',
      requiredIndicator: 'Fields marked with * are required',
      draftRecovered: 'Draft recovered',
      clearDraft: 'Clear',
      updated: 'Updated successfully',
      created: 'Created successfully',
      error: 'An error occurred'
    },

    // Step Form Builder
    stepFormBuilder: {
      next: 'Continue',
      previous: 'Back',
      submit: 'Submit',
      stepOf: 'Step {{current}} of {{total}}',
      pressEnter: 'Press Enter ↵',
      required: 'Required',
      completeStep: 'Please complete this step before continuing',
      allFieldsRequired: 'Please fill all required fields'
    },

    // Scale Input
    scaleInput: {
      outOf: 'out of',
      select: 'Select a value',
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
      expert: 'Expert'
    },

    // Phone Input
    phoneInput: {
      placeholder: 'Enter your WhatsApp number',
      validNumber: 'Valid number',
      invalidNumber: 'Invalid number',
      countryNames: {
        AR: 'Argentina',
        BR: 'Brazil',
        CL: 'Chile',
        CO: 'Colombia',
        MX: 'Mexico',
        PE: 'Peru',
        UY: 'Uruguay',
        PY: 'Paraguay',
        BO: 'Bolivia',
        EC: 'Ecuador',
        VE: 'Venezuela',
        US: 'United States',
        ES: 'Spain'
      }
    },

    // Location Input
    locationInput: {
      label: 'Location',
      placeholder: 'Search address...',
      myLocation: 'My location',
      coordinates: 'Coordinates',
      manualCoordinates: 'Manual coordinate entry',
      latitude: 'Latitude',
      longitude: 'Longitude',
      coordinatesLabel: 'Coordinates:',
      locationError: 'Could not get your location. Check browser permissions.',
      locationErrorGeneric: 'Error getting location',
      clearCoordinates: 'Clear coordinates',
      searchCoordinates: 'Search coordinates',
      clear: 'Clear'
    },

    // Select Input
    selectInput: {
      placeholder: 'Select...',
      noOptions: 'No options available',
      searchPlaceholder: 'Search...',
      selected: 'selected',
      noResults: 'No results',
      clearSelection: 'Clear selection'
    },

    // Textarea Input
    textareaInput: {
      words: 'words'
    },

    // Validation messages
    validation: {
      required: '{{field}} is required',
      minLength: '{{field}} must be at least {{min}} characters',
      maxLength: '{{field}} must be at most {{max}} characters',
      invalidFormat: '{{field}} has invalid format',
      invalidEmail: '{{field}} must have a valid format',
      phoneTooShort: '{{field}} is too short',
      invalidPhone: '{{field}} is not valid',
      phoneLength: '{{field}} must be between 10 and 15 digits',
      invalidUrl: '{{field}} must be a valid URL',
      invalidNumber: '{{field}} must be a valid number',
      minNumber: '{{field}} must be greater than or equal to {{min}}',
      maxNumber: '{{field}} must be less than or equal to {{max}}',
      invalidDate: '{{field}} must be a valid date',
      dateAfter: '{{field}} must be after {{date}}',
      dateBefore: '{{field}} must be before {{date}}',
      locationRequired: '{{field}} is required',
      invalidCoordinates: '{{field}} must have valid coordinates',
      invalidLatitude: 'Latitude must be between -90 and 90',
      invalidLongitude: 'Longitude must be between -180 and 180',
      invalidRelation: '{{field}} must be a valid value',
      invalidRelationMultiple: '{{field}} must be a valid selection',
      validationError: 'Validation error in {{field}}',
      invalid: '{{field}} is invalid'
    }
  },

  'es-AR': {
    // FormBuilder main component
    formBuilder: {
      update: 'Actualizar',
      create: 'Crear',
      cancel: 'Cancelar',
      sending: 'Enviando...',
      configError: 'Error de configuración',
      schemaRequired: 'El parámetro schema es requerido',
      noFields: 'No hay campos para mostrar',
      requiredIndicator: 'Los campos marcados con * son obligatorios',
      draftRecovered: 'Borrador recuperado',
      clearDraft: 'Limpiar',
      updated: 'Actualizado correctamente',
      created: 'Creado correctamente',
      error: 'Ocurrió un error'
    },

    // Step Form Builder
    stepFormBuilder: {
      next: 'Continuar',
      previous: 'Volver',
      submit: 'Enviar',
      stepOf: 'Paso {{current}} de {{total}}',
      pressEnter: 'Presiona Enter ↵',
      required: 'Requerido',
      completeStep: 'Por favor completa este paso antes de continuar',
      allFieldsRequired: 'Por favor completa todos los campos requeridos'
    },

    // Scale Input
    scaleInput: {
      outOf: 'de',
      select: 'Selecciona un valor',
      beginner: 'Principiante',
      intermediate: 'Intermedio',
      advanced: 'Avanzado',
      expert: 'Experto'
    },

    // Phone Input
    phoneInput: {
      placeholder: 'Ingresa tu número de WhatsApp',
      validNumber: 'Número válido',
      invalidNumber: 'Número inválido',
      countryNames: {
        AR: 'Argentina',
        BR: 'Brasil',
        CL: 'Chile',
        CO: 'Colombia',
        MX: 'México',
        PE: 'Perú',
        UY: 'Uruguay',
        PY: 'Paraguay',
        BO: 'Bolivia',
        EC: 'Ecuador',
        VE: 'Venezuela',
        US: 'Estados Unidos',
        ES: 'España'
      }
    },

    // Location Input
    locationInput: {
      label: 'Ubicación',
      placeholder: 'Buscar dirección...',
      myLocation: 'Mi ubicación',
      coordinates: 'Coordenadas',
      manualCoordinates: 'Ingreso manual de coordenadas',
      latitude: 'Latitud',
      longitude: 'Longitud',
      coordinatesLabel: 'Coordenadas:',
      locationError: 'No se pudo obtener tu ubicación. Verifica los permisos del navegador.',
      locationErrorGeneric: 'Error al obtener la ubicación',
      clearCoordinates: 'Limpiar coordenadas',
      searchCoordinates: 'Buscar coordenadas',
      clear: 'Limpiar'
    },

    // Select Input
    selectInput: {
      placeholder: 'Seleccionar...',
      noOptions: 'Sin opciones disponibles',
      searchPlaceholder: 'Buscar...',
      selected: 'seleccionado',
      selectedPlural: 'seleccionados',
      noResults: 'Sin resultados',
      clearSelection: 'Limpiar selección'
    },

    // Textarea Input
    textareaInput: {
      words: 'palabras'
    },

    // Validation messages
    validation: {
      required: '{{field}} es requerido',
      minLength: '{{field}} debe tener al menos {{min}} caracteres',
      maxLength: '{{field}} debe tener máximo {{max}} caracteres',
      invalidFormat: '{{field}} tiene formato inválido',
      invalidEmail: '{{field}} debe tener un formato válido',
      phoneTooShort: '{{field}} es muy corto',
      invalidPhone: '{{field}} no es válido',
      phoneLength: '{{field}} debe tener entre 10 y 15 dígitos',
      invalidUrl: '{{field}} debe ser una URL válida',
      invalidNumber: '{{field}} debe ser un número válido',
      minNumber: '{{field}} debe ser mayor o igual a {{min}}',
      maxNumber: '{{field}} debe ser menor o igual a {{max}}',
      invalidDate: '{{field}} debe ser una fecha válida',
      dateAfter: '{{field}} debe ser posterior al {{date}}',
      dateBefore: '{{field}} debe ser anterior al {{date}}',
      locationRequired: '{{field}} es requerida',
      invalidCoordinates: '{{field}} debe tener coordenadas válidas',
      invalidLatitude: 'Latitud debe estar entre -90 y 90',
      invalidLongitude: 'Longitud debe estar entre -180 y 180',
      invalidRelation: '{{field}} debe ser un valor válido',
      invalidRelationMultiple: '{{field}} debe ser una selección válida',
      validationError: 'Error de validación en {{field}}',
      invalid: '{{field}} es inválido'
    }
  }
};

/**
 * Get translation for a key path
 * @param {string} keyPath - Dot notation path (e.g., 'formBuilder.update')
 * @param {string} lang - Language code
 * @param {Object} replacements - Key-value pairs for interpolation
 * @returns {string} Translated string
 */
export function getTranslation(keyPath, lang = 'en', replacements = {}) {
  // Normalize language code (es, es-AR, es-MX, etc. → es-AR)
  const normalizedLang = lang.toLowerCase().startsWith('es') ? 'es-AR' : 'en';

  // Get translation object for language
  const langTranslations = translations[normalizedLang] || translations.en;

  // Navigate through the key path
  const keys = keyPath.split('.');
  let value = langTranslations;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      // Fallback to English if key not found
      value = translations.en;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return keyPath; // Return key path if not found in any language
        }
      }
      break;
    }
  }

  // If value is not a string, return the key path
  if (typeof value !== 'string') {
    return keyPath;
  }

  // Replace placeholders (e.g., {{field}}, {{min}}, {{max}})
  let result = value;
  for (const [key, replacement] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), replacement);
  }

  return result;
}

/**
 * Get all translations for a section
 * @param {string} section - Section name (e.g., 'formBuilder')
 * @param {string} lang - Language code
 * @returns {Object} Section translations
 */
export function getSection(section, lang = 'en') {
  const normalizedLang = lang.toLowerCase().startsWith('es') ? 'es-AR' : 'en';
  const langTranslations = translations[normalizedLang] || translations.en;
  return langTranslations[section] || translations.en[section] || {};
}

export default translations;
