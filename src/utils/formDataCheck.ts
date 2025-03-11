// This utility fixes the incorrectly coded FormData check in axios
// that was causing a syntax error in the bundled JS

export const isFormData = (thing: unknown): boolean => {
  return Boolean(
    thing && 
    (typeof FormData !== 'undefined' && thing instanceof FormData ||
      typeof thing === 'object' && 
      typeof (thing as any).toString === 'function' && 
      (thing as any).toString() === '[object FormData]')
  );
};