import neo4j from "neo4j-driver";

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER || process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;

if (!uri || !user || !password) {
    throw new Error("Missing required Neo4j environment variables (NEO4J_URI, NEO4J_USER/NEO4J_USERNAME, NEO4J_PASSWORD)");
}

const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(user, password)
);

try {
    await driver.verifyConnectivity();
    console.log("Connected to", uri);
}
finally {
    await driver.close();
}
