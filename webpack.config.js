//webpack.config.js
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
var removeSourceMapUrlWebpackPlugin = require('@rbarilani/remove-source-map-url-webpack-plugin');

// Production builds (NODE_ENV=production, used by `npm run compile:prod`)
// minify the bundle and strip console.* calls entirely (Improvement Item 5).
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
	mode: isProduction ? 'production' : 'development',
	devtool: isProduction ? false : 'inline-source-map',
	entry: {
		main: "./src/panel/main.ts",
	},
	output: {
		path: path.resolve(__dirname, './media'),
		filename: "[name]-bundle.js", // <--- Will be compiled to this single file
		library: {
			name: 'pokemonApp',
			type: 'global'
		}
	},
	optimization: isProduction
		? {
				minimize: true,
				minimizer: [
					new TerserPlugin({
						terserOptions: {
							compress: {
								drop_console: true,
							},
						},
					}),
				],
		  }
		: undefined,
	plugins: [
		new removeSourceMapUrlWebpackPlugin({
			test: /main-bundle\.js$/
		})
	],
	resolve: {
		extensions: [".ts", ".tsx", ".js"],
	},
	module: {
		rules: [{
			test: /\.ts$/,
			exclude: /node_modules/,
			use: [
				{
					loader: 'ts-loader',
					options: {
						configFile: 'tsconfig.panel.json'
					}
				},
			],
		}]
	},
};
