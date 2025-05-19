// Uitls
async function getCurrentUser() {
    try {
        let res = await ZOHO.CRM.CONFIG.getCurrentUser();
        if (!res) throw new Error(res);
        return res.users[0];
    } catch (error) {
        throw new Error(error);
    }
}

async function getData() {
    try {
        let response = await ZOHO.CRM.API.getAllRecords({ Entity: "checkincheckoutbaidu__Attendance", page: 1 });
        if (!response?.data) {
            if (response?.status === 204) return [];
            throw new Error(`${response.status}`);
        }
        return response?.data;
    } catch (error) {
        console.error(error)
        throw new Error(error);
    }
}

// main function start
ZOHO.embeddedApp.on("PageLoad", async function (data) {
    let toggleSwitch = document.getElementById("toggleSwitch");
    let toggleText = document.getElementById("toggleText");
    let progressBar = document.getElementById("progressBar");
    let statusMessage = document.getElementById("statusMessage");

    let current_User = await getCurrentUser();
    let logData = await getData();

    logData = logData.filter(item => item.Created_By.id === current_User.id);

    let isCheckedIn = logData.length > 0 ? logData[0].checkincheckoutbaidu__Status === 'Checked-In' : false;

    if (isCheckedIn) {
        toggleSwitch.checked = isCheckedIn;
        toggleText.innerText = 'Check Out';
    }

    function showLoading() {
        statusMessage.style.display = "block";
        progressBar.style.display = "block";
        toggleSwitch.disabled = true;
    }

    function hideLoading() {
        statusMessage.style.display = "none";
        progressBar.style.display = "none";
        toggleSwitch.disabled = false;
    }

    async function createRecord(lat, long, time, loc) {
        let name, count, splittedValues;
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US'); // Adjust locale to match your needs
        if (logData.length > 0) {
            splittedValues = logData[0].Name.split('_');
            if (splittedValues[0] === formattedDate) {
                count = Number(splittedValues[1]);
                name = `${splittedValues[0]}_${++count}`;
            } else {
                name = `${formattedDate}_1`;
            }
        } else {
            name = `${formattedDate}_1`;
        }

        var recordData = {
            "checkincheckoutbaidu__Check_In_Location": `${loc}`,
            "checkincheckoutbaidu__Check_in_Latitude": `${lat}`,
            "checkincheckoutbaidu__Check_in_Longitude": `${long}`,
            "checkincheckoutbaidu__Check_In_Time": `${time}`,
            "Name": name,
            "checkincheckoutbaidu__Check_out_Latitude": '-',
            "checkincheckoutbaidu__Check_out_Longitude": '-',
            "checkincheckoutbaidu__Check_out_Time": '-',
            "checkincheckoutbaidu__Status": "Checked-In",
            // "checkincheckoutbaidu__Duration": "-",
            "checkincheckoutbaidu__Check_Out_Location": '-'
        }
        try {
            let response = await ZOHO.CRM.API.insertRecord({ Entity: "checkincheckoutbaidu__Attendance", APIData: recordData, Trigger: ["workflow"] });
            if (response?.data[0]?.status === "error") {
                fetch('/data', {
                    method: "POST",
                    body: JSON.stringify(response?.data[0])
                })
                throw new Error(response?.data[0]?.message);
            }
            return true;
        } catch (error) {
            throw new Error(error);
        }
    }

    async function updateRecord(lat, long, time, loc) {
        let latestRecords = await getData();

        let FilteredRecords = latestRecords.filter(item => item.Created_By.id === current_User.id);

        let check_in_time = new Date(FilteredRecords[0].checkincheckoutbaidu__Check_In_Time);
        let duration = new Date(time).getTime() - check_in_time.getTime();

        // Convert the duration from milliseconds to hours, minutes, and seconds
        const hours = Math.floor(duration / (1000 * 60 * 60));  // Hours
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));  // Minutes
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);  // Seconds

        // Format the result as hr:min:sec
        const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        let config = {
            Entity: "checkincheckoutbaidu__Attendance",
            APIData: {
                "id": FilteredRecords[0].id,
                "checkincheckoutbaidu__Check_Out_Location": `${loc}`,
                "checkincheckoutbaidu__Check_out_Latitude": `${lat}`,
                "checkincheckoutbaidu__Check_out_Longitude": `${long}`,
                "checkincheckoutbaidu__Check_out_Time": `${time}`,
                "checkincheckoutbaidu__Status": "Checked-Out",
                // "checkincheckoutbaidu__Duration": formattedDuration
            },
            Trigger: ["workflow"]
        }
        try {
            let response = await ZOHO.CRM.API.updateRecord(config);
            if (response?.data[0]?.status === "error") throw new Error(response?.data[0]?.message);
            return true;
        } catch (error) {
            throw new Error(error);
        }


    }
    async function updateTable() {
        const tableBody = document.getElementById("tableBody");
        logData = await getData();
        logData = logData.filter(item => item.Created_By.id === current_User.id);
        tableBody.innerHTML = logData.length ? logData.map((entry, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${entry.Name}</td>
                    <td>${entry.checkincheckoutbaidu__Check_In_Time}</td>
                    <td>${entry.checkincheckoutbaidu__Check_In_Location}</td>
                    <td>${entry.checkincheckoutbaidu__Check_in_Latitude}</td>
                    <td>${entry.checkincheckoutbaidu__Check_in_Longitude}</td>
                    <td>${entry.checkincheckoutbaidu__Check_out_Time}</td>
                    <td>${entry.checkincheckoutbaidu__Check_Out_Location}</td>
                    <td>${entry.checkincheckoutbaidu__Check_out_Latitude}</td>
                    <td>${entry.checkincheckoutbaidu__Check_out_Longitude}</td>
                    </tr>
                    `).join('') : `<tr class="no-records"><td colspan="11">No records found</td></tr>`;
    }
    // <td>${entry.checkincheckoutbaidu__Duration} </td>
    document.querySelector('#toggleSwitch').addEventListener('change', toggleCheckInOut);
    async function toggleCheckInOut() {
        showLoading();
        let result = await getAddress();
        console.log(result);
        const timeNow = new Date().toLocaleString();
        if (!isCheckedIn) {
            await createRecord(result.lat, result.lng, timeNow, result.loc);
            toggleText.innerText = "Check Out";
        } else {
            await updateRecord(result.lat, result.lng, timeNow, result.loc);
            toggleText.innerText = "Check In";
        }
        isCheckedIn = !isCheckedIn;
        await updateTable();
        hideLoading();
        //     navigator.geolocation.getCurrentPosition(async (position) => {
        //         const lat = position.coords.latitude;
        //         const lon = position.coords.longitude;
        //         let address = await retrieveAddress({ "coords": `${lat},${lon}` });
        //         const timeNow = new Date().toLocaleString();

        //         if (!isCheckedIn) {
        //             await createRecord(lat, lon, timeNow, address);
        //             toggleText.innerText = "Check Out";
        //         } else {
        //             await updateRecord(lat, lon, timeNow, address);
        //             toggleText.innerText = "Check In";
        //         }

        //         isCheckedIn = !isCheckedIn;
        //         await updateTable();
        //         hideLoading();
        //     }, () => {
        //         alert("Unable to fetch location. Please check your GPS settings.");
        //         hideLoading();
        //     });
        // }
        // await updateTable();

        // let loopCount = 0;
        // async function retrieveAddress(coords) {
        //     try {
        //         let response = await ZOHO.CRM.FUNCTIONS.execute("checkincheckoutbaidu__reversegeocode", coords);
        //         let result = JSON.parse(response?.details?.output)
        //         if (!result?.status == 0) {
        //             alert(`Error Click Okay to retry! Error:${result?.message}`);
        //             throw new Error(result?.message);
        //         }
        //         return result?.result.formatted_address;
        //     } catch (error) {
        //         while (loopCount < 3) {
        //             loopCount++;
        //             await retrieveAddress(coords);
        //         }
        //         hideLoading();
        //         alert('Failed to fetch location!')
        //         return 'Unknown';
        //     }
    }
    await updateTable();
})
ZOHO.embeddedApp.init();

// async function RetrieveAddress(lat, lng) {
//     try {
//         let response = await fetch('https://api.map.baidu.com/reverse_geocoding/v3' + new URLSearchParams({
//             ak: `${accessKey}`,
//             location: `${lat},${lng}`,
//             output: 'json',
//             language: 'en',
//             language_auto: 1
//         }).toString(), {
//             method: "GET",
//         })
//         if (!response.ok) throw new Error(response);
//         let result = await response.json();
//         if (result.status !== 0) throw new Error(result);
//         return result.result.formatted_address;
//     } catch (error) {
//         throw new Error(error);

//     }

// }

function getAddress() {
    return new Promise((resolve, reject) => {
        let geo = new BMap.Geolocation();
        let geoCoder = new BMap.Geocoder();

        geo.getCurrentPosition((data) => {
            console.log(data);
            if (data.accuracy > 200) alert('Low Accuracy!')
            if (geo.getStatus() === 0) {
                geoCoder.getLocation(data.point, (rs) => {
                    resolve({
                        lat: data.latitude,
                        lng: data.longitude,
                        loc: rs.address,
                        accuracy: data.accuracy
                    });
                });
            } else {
                reject(new Error("Failed to get current position"));
            }
        }, {
            enableHighAccuracy: true,
        });
    });
}

// async function getAccessKey() {
//     try {
//         let res = await ZOHO.CRM.API.getOrgVariable("checkincheckoutbaidu__AccessKey");
//         return res.Success.Content;
//     } catch (error) {
//         throw new Error(error);

//     }
// }
// var accessKey = await getAccessKey();
