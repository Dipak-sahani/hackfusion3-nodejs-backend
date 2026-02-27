/**
 * Normalizes quantity based on unit and tablets per strip
 * @param {number} quantity - The quantity ordered or stocked
 * @param {string} unit - 'tablet' or 'strip'
 * @param {number} tabletsPerStrip - Normalization factor (default 10)
 * @returns {number} Normalized quantity in tablets
 */
export const normalizeToTablet = (quantity, unit, tabletsPerStrip = 10) => {
    if (quantity < 0) {
        throw new Error('Quantity cannot be negative');
    }

    const normalizedUnit = unit?.toLowerCase();

    if (normalizedUnit === 'strip') {
        return quantity * tabletsPerStrip;
    } else if (normalizedUnit === 'tablet' || !normalizedUnit) {
        return quantity;
    } else {
        throw new Error(`Invalid unit: ${unit}. Supported units are 'tablet' and 'strip'.`);
    }
};

/**
 * Calculates the next refill date based on stock and consumption
 * @param {number} totalTablets - Total stock in tablets
 * @param {number} dailyConsumption - Daily intake in tablets
 * @returns {Date|null} Predicted refill date or null if not calculable
 */
export const calculateRefillDate = (totalTablets, dailyConsumption) => {
    if (dailyConsumption <= 0) {
        return null;
    }

    if (totalTablets <= 0) {
        return new Date(); // Out of stock today
    }

    const totalDays = Math.floor(totalTablets / dailyConsumption);
    const refillDate = new Date();
    refillDate.setDate(refillDate.getDate() + totalDays);

    return refillDate;
};
