const GISService = {
  // Esri World Geocoder URL
  GEOCODE_URL: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
  
  // Iguá Atibaia Esgoto MapServer - Layer 10: Poço de Visita (PV)
  PV_LAYER_URL: 'https://gis.iguasa.com.br/server/rest/services/ATB/ATB_Esgoto/MapServer/10/query',

  /**
   * Converte um endereço em coordenadas (Lat/Lng) focando na cidade de Atibaia, SP.
   */
  async geocodeAddress(address) {
    try {
      const params = new URLSearchParams({
        SingleLine: address,
        city: 'Atibaia',
        region: 'SP',
        countryCode: 'BRA',
        f: 'json',
        outSR: '4326',
        maxLocations: '1'
      });

      const response = await fetch(`${this.GEOCODE_URL}?${params.toString()}`);
      if (!response.ok) throw new Error('Falha na comunicação com o serviço de geocodificação.');
      
      const data = await response.json();
      
      if (data.candidates && data.candidates.length > 0) {
        const location = data.candidates[0].location;
        return { lat: location.y, lng: location.x, addressMatch: data.candidates[0].address };
      }
      return null;
    } catch (error) {
      console.error('Erro ao geocodificar endereço:', error);
      return null;
    }
  },

  /**
   * Consulta a camada de PV num raio de 50 metros da coordenada e retorna o PV mais profundo.
   */
  async analyzeNetworkAtLocation(lat, lng) {
    try {
      const params = new URLSearchParams({
        geometry: `${lng},${lat}`,
        geometryType: 'esriGeometryPoint',
        spatialRel: 'esriSpatialRelIntersects',
        distance: '50', // raio de 50 metros
        units: 'esriSRUnit_Meter',
        outFields: 'PROFUNDIDADEINTERIOR',
        returnGeometry: 'false',
        f: 'json'
      });

      const response = await fetch(`${this.PV_LAYER_URL}?${params.toString()}`);
      if (!response.ok) throw new Error('Falha na comunicação com o servidor GIS da Iguá.');

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        // Encontrar o PV com maior PROFUNDIDADEINTERIOR
        let maxDepth = 0;
        let pvsFound = data.features.length;
        
        for (const feature of data.features) {
          const depth = feature.attributes.PROFUNDIDADEINTERIOR;
          if (depth && depth > maxDepth) {
            maxDepth = depth;
          }
        }
        
        return {
          found: true,
          count: pvsFound,
          maxDepth: maxDepth
        };
      }
      
      return { found: false, count: 0, maxDepth: 0 };
    } catch (error) {
      console.error('Erro ao consultar servidor GIS:', error);
      return null;
    }
  }
};
