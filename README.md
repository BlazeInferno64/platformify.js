# platformify.js

A lightweight, comprehensive, zero-dependency browser and hardware profiling library made in pure vanilla JavaScript

# Importing platformify.js

Raw script link:

```
https://raw.githubusercontent.com/
```

Alternatively you may also,

Load directly using the script tag of html:

```html
<script src=""></script>
```


# Live testing

Try the code in <a href="https://blazeinferno64.github.io/jolt.html?code=%2F%2F%20This%20code%20snippet%20is%20generated%20by%20platformify.js%0Atry%20%7B%0A%20%20%20%20const%20platformify%20%3D%20new%20Platformify()%3B%0A%20%20%20%20const%20payload%20%3D%20await%20platformify.getSystemInfo()%3B%0A%20%20%20%20%0A%20%20%20%20console.log(payload)%3B%20%2F%2F%20Log%20the%20payload%20to%20the%20console%20for%20inspection%0A%7D%20catch%20(error)%20%7B%0A%20%20%20%20console.error(error)%3B%20%2F%2F%20Log%20any%20errors%20that%20occur%20during%20the%20process%0A%7D&run=true">Jolt</a>

# Api usage

```js

try {
    const platformify = new Platformify();
    const payload = await platformify.getSystemInfo();
    
    console.log(payload); // Log the payload to the console for inspection
} catch (error) {
    console.error(error); // Log any errors that occur during the process
}
```

# LICENSE

`platformify.js` is released under the MIT License.

View the full license terms <a href="https://github.com/BlazeInferno64/platformify.js/blob/main/LICENSE">here</a>.

# Bugs & Issues

Found a bug or want a new feature?

Report issues and request features on the [platformify.js issue tracker](https://github.com/blazeinferno64/platformify.js/issues).

`Thanks for reading!`

`Have a great day ahead :D`