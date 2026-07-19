export const ALERT_THRESHOLDS_KEY = 'vortex-alert-thresholds'
export interface AlertThresholds { cpu: number; ram: number; gpu: number }
export const DEFAULT_THRESHOLDS: AlertThresholds = { cpu: 90, ram: 90, gpu: 95 }
