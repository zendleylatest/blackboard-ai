export const generateOtp = () => {
    return Math.floor(
        100000 + Math.random() * 900000
    ).toString();
};

export const generateOtpExpiry = (
    minutes = 10
) => {

    return new Date(
        Date.now() + minutes * 60 * 1000
    );

};

export const isOtpValid = (
    storedOtp,
    storedExpiry,
    enteredOtp
) => {

    return (
        storedOtp === enteredOtp &&
        new Date() <= new Date(storedExpiry)
    );

};