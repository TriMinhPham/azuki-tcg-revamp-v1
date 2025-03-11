
const fetch = require("node-fetch");

async function testServer() {
  try {
    console.log("Testing server health endpoint...");
    const response = await fetch("http://localhost:3001/api/health");
    
    if (\!response.ok) {
      console.error(`Server returned status ${response.status}: ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    console.log("Server health check successful:");
    console.log(JSON.stringify(data, null, 2));
    
    // Test card endpoint
    console.log("Testing card endpoint with token ID 1834...");
    const cardResponse = await fetch("http://localhost:3001/api/card/1834");
    
    if (\!cardResponse.ok) {
      console.error(`Card endpoint returned status ${cardResponse.status}: ${cardResponse.statusText}`);
      const errorText = await cardResponse.text();
      console.error("Error details:", errorText);
      return;
    }
    
    console.log("Card endpoint response successful\!");
    const cardData = await cardResponse.json();
    console.log("Card response success:", cardData.success);
  } catch (error) {
    console.error("Error testing server:", error.message);
    console.error(error.stack);
  }
}

testServer();

