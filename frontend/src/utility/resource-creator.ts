export const createResource = (promise: Promise<any>) => {
    let status = 'pending';
    let result: any;
    let suspender = promise.then(
        (res) => {
            status = 'success';
            result = res;
        },
        (err) => {
            status = 'error';
            result = err;
        }
    );

    return {
        read() {
            if (status === 'pending') throw suspender;
            if (status === 'error') throw result;
            return result;
        }
    };
};
