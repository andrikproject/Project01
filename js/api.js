/**
 * API Service for equran.id and Aladhan
 * Handles all API calls with caching and error handling
 */

const API = (() => {
  const BASE_URL = 'https://equran.id/api/v2';
  const ALADHAN_URL = 'https://api.aladhan.com/v1';
  let surahCache = null;

  /**
   * Fetch all 114 surahs
   * @returns {Promise<Array>} Array of surah objects
   */
  async function getAllSurahs() {
    if (surahCache) {
      return surahCache;
    }

    try {
      const response = await fetch(`${BASE_URL}/surat`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.code === 200 && result.data) {
        surahCache = result.data;
        return surahCache;
      }
      throw new Error('Invalid API response');
    } catch (error) {
      console.error('Error fetching surahs:', error);
      throw error;
    }
  }

  /**
   * Fetch a single surah with all ayahs
   * @param {number} nomor - Surah number (1-114)
   * @returns {Promise<Object>} Surah object with ayahs
   */
  async function getSurahDetail(nomor) {
    try {
      const response = await fetch(`${BASE_URL}/surat/${nomor}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.code === 200 && result.data) {
        return result.data;
      }
      throw new Error('Invalid API response');
    } catch (error) {
      console.error(`Error fetching surah ${nomor}:`, error);
      throw error;
    }
  }

  /**
   * Fetch prayer times by city from Aladhan API
   * @param {string} city - City name
   * @param {string} country - Country name
   * @returns {Promise<Object>} Prayer times data
   */
  async function getPrayerTimes(city, country) {
    try {
      const response = await fetch(
        `${ALADHAN_URL}/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=20`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.code === 200 && result.data) {
        return result.data;
      }
      throw new Error('Invalid API response');
    } catch (error) {
      console.error('Error fetching prayer times:', error);
      throw error;
    }
  }

  /**
   * Convert Gregorian date to Hijri using Aladhan API
   * @param {string} date - Date in DD-MM-YYYY format
   * @returns {Promise<Object>} Hijri date data
   */
  async function getHijriDate(date) {
    try {
      const response = await fetch(`${ALADHAN_URL}/gpiToH/${date}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.code === 200 && result.data) {
        return result.data;
      }
      throw new Error('Invalid API response');
    } catch (error) {
      console.error('Error fetching Hijri date:', error);
      throw error;
    }
  }

  /**
   * Clear the surah cache
   */
  function clearCache() {
    surahCache = null;
  }

  return {
    getAllSurahs,
    getSurahDetail,
    getPrayerTimes,
    getHijriDate,
    clearCache
  };
})();
