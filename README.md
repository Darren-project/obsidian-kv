# Key-Value Store Plugin for Obsidian

This plugin adds a key-value store to Obsidian, allowing you to store and retrieve key-value pairs in your vault.

## Installation

1. Open Obsidian.
2. Go to `Settings > Third-party plugin`.
3. Make sure `Safe mode` is off.
4. Click `Browse` and search for "KV Store".
5. Click `Install`.
6. Once installed, toggle the switch to enable the plugin.

## Usage

Once the plugin is installed and enabled, you can access the key-value store from the settings page.

1. Go to `Settings > KV Store`.
2. Here, you will see a textarea where you can view, add, modify, or delete your key-value data.

The data should be in JSON format, like this:

```json
{
    "key1": "value1",
    "key2": "value2",
    "key3": "value3"
}
```

To add a new key-value pair, simply add a new line with your key and value, like this:

```json
{
    "key1": "value1",
    "key2": "value2",
    "key3": "value3",
    "key4": "value4"
}
```

To modify a value, change the value next to the key, like this:

```json
{
    "key1": "value1",
    "key2": "value2",
    "key3": "new value"
}
```

To delete a key-value pair, remove the line with the key and value, like this:

```json
{
    "key1": "value1",
    "key2": "value2"
}
```

After making changes, the plugin will automatically save your data. If your data is not valid JSON, the plugin will show an error message.

## JS Docs
```js
kv.set(name: string, value: any)

kv.get(name: string)

kv.delete(name: string)

kv.has(name: string)

kv.keys()

kv.values()

kv.entries()
```

## Support

If you encounter any issues or have any questions about this plugin, please open an issue on the GitHub repository.

## License

This plugin is licensed under the Apache License. See the `LICENSE` file for more information.
