# Aloe Frontend
This repository contains the frontend source code for the 3 Aloe web apps:
- [Aloe Blend](https://app.aloe.capital)
- [Aloe Earn](https://earn.aloe.capital)
- [Aloe Prime](https://prime.aloe.capital)
## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/en/download/)
- [Yarn](https://yarnpkg.com/getting-started/install)

### Installing dependencies
From within the root directory:
```
yarn install
```

The frontend repository is a monorepo that contains 3 separate apps. Additionally, the `shared` directory contains shared components and utilities that are used by both earn and prime.

### Setting up the environment
The frontend uses environment variables to configure the app. These variables are stored in the `.env` file in the root directory. Despite the fact that we include our envionment variables in the repository, they will not work for you. You will need to create your own `.env` file and populate it with the correct values.

More specifically, you will need to create a `.env` file in the root directory and populate it with the following variables:
```
REACT_APP_ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
REACT_APP_ALCHEMY_API_KEY=YOUR_ALCHEMY_API_KEY
REACT_APP_INFURA_ID=YOUR_INFURA_ID
```

We also include a `REACT_APP_SENTRY_DSN` variable, but this is optional. If you do not have a [Sentry](sentry.io) account, you can leave this variable out.

### Running the apps

#### Blend
To run the Blend app, run the following command from the root directory:
```
cd blend
yarn start
```

To build the Blend app for production, run the following command from the root directory:
```
cd blend
yarn build
```
The build will be output to the `build` directory.
See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

#### Earn
To run the Earn app, run the following command from the root directory:
```
cd earn
yarn start
```
> Note that the `yarn start` command will also build the `shared` directory. If you are making changes to the `shared` directory, you will need to stop the app and run `yarn start` again to see the changes. Changes made to the `earn` directory will be reflected immediately however.

To build the Earn app for production, run the following command from the root directory:
```
cd earn
yarn build
```
The build will be output to the `build` directory.
See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

#### Prime
To run the Prime app, run the following command from the root directory:
```
cd prime
yarn start
```
> Note that the `yarn start` command will also build the `shared` directory. If you are making changes to the `shared` directory, you will need to stop the app and run `yarn start` again to see the changes. Changes made to the `prime` directory will be reflected immediately however.

To build the Prime app for production, run the following command from the root directory:
```
cd prime
yarn build
```
The build will be output to the `build` directory.
See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Learn More

You can learn more in the [Aloe documentation](https://docs.aloe.capital/).

To learn React, check out the [React documentation](https://reactjs.org/).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
