#! /usr/bin/env node
/**
 * A CLI tool to update your favorite text editor theme. Emphasizes comments
 * and mutes everything else.
 *
 * See http://github.com/rileyjshaw/literate-theme for details.
 *
 * Usage:
 *
 *     node mute-theme.js [options] input-theme.tmTheme
 *
 *     Options:
 *     -o <path>            output file.
 *     -fg <hex color>      6-digit CSS hex string, eg. '#112233'.
 *     - color <hex color>  6-digit CSS hex string, eg. '#112233'.
 */
const fs = require('fs');
const minimist = require('minimist');
const muteColor = require('mute-color');
const path = require('path');
const {pd} = require('pretty-data');
const {DOMParser, XMLSerializer} = require('xmldom');

// Parse out CLI arguments.
const argv = minimist(process.argv.slice(2));
const inputFile = argv._[0];
const outputFile = argv.o ||
    `${path.dirname(inputFile)}/Literate-${path.basename(inputFile)}`;
const fgColor = argv.fg || '#a8b8b8';
const commentColor = argv.color || '#bbff99';
const toMuted = muteColor(fgColor);

// Instantiate our XML tools.
const parser = new DOMParser();
const serializer = new XMLSerializer();

fs.readFile(inputFile, 'utf8', (err, xml) => {
    if (err) throw err;

    // If we minify the XML before parsing it, we avoid dealing with a bunch of
    // whitespace-only nodes.
    const xmlObject = parser.parseFromString(pd.xmlmin(xml));
    const {
        author,
        name,
        semanticClass,
        settings: parentSettings,
    } = xmlZip(xmlObject.documentElement.firstChild);

    // Replace some header fields.
    if (author) {author.data = 'rileyjshaw (http://rileyjshaw.com)';}
    if (name) {name.data = `Literate ${name.data}`;}
    if (semanticClass) {semanticClass.data = `literate.${semanticClass.data}`;}

    Array.from(parentSettings.childNodes)
        .forEach(node => {
            const children = xmlZip(node);
            const {settings} = children;

            // Exit early if the node doesn't have settings or foreground keys.
            if (!settings) {return;}
            const {foreground} = xmlZip(settings);
            if (!foreground) {return;}

            // Exit early from the default settings block.
            if (!children.scope) {
                return foreground.data = fgColor;
            }

            // Exit early from any blocks scoped to "comments".
            if (children.scope.data.includes('comment')) {
                return foreground.data = commentColor;
            }

            // NOTE: Just updates the "foreground" field for now.
            foreground.data = toMuted(foreground.data.slice(0, 7)) +
                foreground.data.slice(7);
        })
        ;

    const output = pd.xml(serializer.serializeToString(xmlObject));
    fs.writeFile(outputFile, output, (err) => {
        if (err) throw err;
        console.log(`Saved to ${outputFile}`);
    });
});

/**
 * Makes the following XML:
 *
 * <key>foreground</key>
 * <string>#65737e</string>
 *
 * ...easier to work with by returning an object in the form:
 *
 * {
 *     foreground: {
 *         data: '#989898',
 *     },
 *
 *     // ...
 * }
 *
 * We keep the value in a `data` object so we can directly mutate it, i.e:
 *
 * `obj.foreground.data = '#424242';  // Persists! Yuck, and also yay.`
 *
 *
 * @param  {object} node   XML node from xmldom's DOMParser with a valid
 *                             `childNodes` collection.
 * @return {object}        Simple object with keys from `node`'s <key> tags.
 */
function xmlZip (node) {
    return Array.from(node.childNodes)
        .filter(({tagName}) => tagName === 'key')
        .reduce((acc, cur) => Object.assign({}, acc, {
            // Shortcut to the firstChild of <string> nodes since that's all we
            // care about there.
            [cur.firstChild.data]: cur.nextSibling.tagName === 'string' ?
                cur.nextSibling.firstChild : cur.nextSibling,
        }), {})
        ;
}
