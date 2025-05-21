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

//  Both () for loading icons
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

// getting the current location address
function getAddress() {
    return new Promise((resolve, reject) => {
        let geo = new BMap.Geolocation();
        let geoCoder = new BMap.Geocoder();

        geo.getCurrentPosition((data) => {
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

// create the new Check-In record 
async function createRecord(fetchedGeoCoding, time,s,checkINOutStatus) {
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
        "checkincheckoutbaidu__Check_In_Location": `${fetchedGeoCoding.loc}`,
        "checkincheckoutbaidu__Check_in_Latitude": `${fetchedGeoCoding.lat}`,
        "checkincheckoutbaidu__Check_in_Longitude": `${fetchedGeoCoding.lng}`,
        "checkincheckoutbaidu__Check_In_Time": `${time}`,
        "Name": name,
        "checkincheckoutbaidu__Check_out_Latitude": '-',
        "checkincheckoutbaidu__Check_out_Longitude": '-',
        "checkincheckoutbaidu__Check_out_Time": '-',
        "checkincheckoutbaidu__Status": "Checked-In",
        "checkincheckoutbaidu__CheckIn_Type": `${checkINOutStatus}`,
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

// for updating the checkOut data
async function updateRecord(fetchedGeoCoding, time, current_User) {
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
            "checkincheckoutbaidu__Check_Out_Location": `${fetchedGeoCoding.loc}`,
            "checkincheckoutbaidu__Check_out_Latitude": `${fetchedGeoCoding.lat}`,
            "checkincheckoutbaidu__Check_out_Longitude": `${fetchedGeoCoding.lng}`,
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

async function updateTable(current_User) {
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

// check in check out status
async function CheckInOutStatus(CheckInStatus) {
    let fetchedGeoCoding = await getAddress()

    const lat = 12.500992;
    const lng = 80.1538048;

    // Calculate offsets for 50m x 50m box
    const latOffset = (25 / 111000); // ≈ 0.000225
    const lngOffset = (25 / (111000 * Math.cos(lat * Math.PI / 180)));

    const sw = new BMap.Point(lng - lngOffset, lat - latOffset);
    const ne = new BMap.Point(lng + lngOffset, lat + latOffset);
    const bounds = new BMap.Bounds(sw, ne);
    const point = new BMap.Point(fetchedGeoCoding.lng, fetchedGeoCoding.lat); // current point

    if (bounds.containsPoint(point)) { // check if your location is inside
        CheckInStatus.innerText = "Office In"
    } else {
        CheckInStatus.innerText = "Remote In";
    }
    let CheckInOutStatus = CheckInStatus.innerText === "Office In" ? "Office In" : "Remote In";
    return CheckInOutStatus;
}

// Run the function after Page load
ZOHO.embeddedApp.on("PageLoad", async function (data) {
    let toggleSwitch = document.getElementById("toggleSwitch");
    let toggleText = document.getElementById("toggleText");
    let CheckInStatus = document.getElementById("CheckInStatus")
    let progressBar = document.getElementById("progressBar");
    let statusMessage = document.getElementById("statusMessage");

    let current_User = await getCurrentUser();
    let logData = await getData();

    logData = logData.filter(item => item.Created_By.id === current_User.id);

    let isCheckedIn = logData.length > 0 ? logData[0].checkincheckoutbaidu__Status === 'Checked-In' : false;

    if (isCheckedIn) {
        toggleSwitch.checked = isCheckedIn;
        toggleText.innerText = 'Check Out';
        CheckInOutStatus(CheckInStatus)
    }

    // main function of this context.
    async function toggleCheckInOut() {
        showLoading()
        try {
            let fetchedGeoCoding = await getAddress()
            const timeNow = new Date().toLocaleString();

            if (isCheckedIn == false) {
                let checkINOutStatus = await CheckInOutStatus(CheckInStatus)
                await createRecord(fetchedGeoCoding, timeNow, current_User, checkINOutStatus);
                toggleText.innerText = "Check Out";
            } else {
                isCheckedIn = await updateRecord(fetchedGeoCoding, timeNow, current_User);
                CheckInStatus.innerText = ''
                toggleText.innerText = "Check In";
            }
            isCheckedIn = !isCheckedIn;
        } catch (err) {
            console.log(err.message)
        }

        await updateTable(current_User);
        hideLoading();
    }

    document.querySelector('#toggleSwitch').addEventListener('change', () => toggleCheckInOut());
    await updateTable(current_User);
})
ZOHO.embeddedApp.init();
