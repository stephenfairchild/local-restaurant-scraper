require("dotenv").config();
const axios = require("axios");

const key = process.env.GOOGLE_API_KEY;
const knex = require("knex")({
    client: "mysql",
    connection: {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: 3306,
    },
});

async function handle() {
    const fiveMiles = 1609 * 5;
    const huntingtonCoordinates = "38.413901,-82.442029";
    const data = await ingestRestaurants(huntingtonCoordinates, fiveMiles);
}

/**
 * This method takes a query string and searches Google for a list of restaurants that match that
 * string criteria and uploads them into the restaurants table.
 */
async function ingestRestaurants(coordinates, radius, nextPageToken = null) {
    let requestUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?location=${coordinates}&radius=${radius}&type=restaurant&key=${key}`;

    if (nextPageToken) {
        requestUrl = requestUrl + `&next_page_token=${nextPageToken}`;
    }

    try {
        const { data } = await axios.get(requestUrl);

        if (data.status === "OK" && data.results.length > 0) {
            data.results.forEach(
                async ({ name, formatted_address = "", place_id }) => {
                    const detailQueryResult = await axios.get(
                        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&key=${key}`
                    );

                    const {
                        data: {
                            result: {
                                number = "",
                                website = "",
                                price_level = "",
                                rating = "",
                            },
                        },
                    } = detailQueryResult;

                    await knex.raw(
                        `INSERT INTO restaurants(name,address,place_id,number,website,price_level,rating)
                VALUES (:name, :formatted_address, :place_id, :number, :website, :price_level, :rating)`,
                        {
                            name,
                            formatted_address,
                            place_id,
                            number,
                            website,
                            price_level,
                            rating,
                        }
                    );
                }
            );
        }

        // There is a short delay between when the next page token is issued and when it will
        // become valid.
        //setTimeout(() => {
        //    if (
        //        "next_page_token" in data &&
        //        data.next_page_token !== "" &&
        //        data.next_page_token !== null
        //    ) {
        //        ingestRestaurants(coordinates, radius, data.nextPageToken);
        //    }
        //}, 3000);
    } catch (err) {
        console.log(err);
    }
}

handle();
