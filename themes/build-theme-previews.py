####################################################################################################
# Deploys preview to output
####################################################################################################

####################################################################################################
# Imports
import argparse
import logging
import subprocess
import os

from rich.logging import RichHandler
from rich.console import Console

####################################################################################################
# Logger setup
FORMAT = "%(message)s"
logging.basicConfig(
    level="NOTSET",
    format=FORMAT,
    datefmt="[%X]",
    handlers=[RichHandler(show_path=False, console=Console(force_terminal=True))]
)
logger = logging.getLogger()

####################################################################################################
# Constants and templates
## Additional Pelican settings to be added to the sample pelicanconf.py for theme preview generation
PELICANCONF_PATCH = """PLUGINS = ['webassets']"""

## HTML templates for the generated index and 404 pages
HTML_HEADER = """\
    <!DOCTYPE html>
    <html>
        <head>

            # Page title and meta tags
            <style>

                # Basic styling for the generated index and failed themes pages
                h1 {
                margin: 20px auto;
                text-align: center;
                }

                # Flexbox layout for theme preview list
                ul {
                list-style-type: none;
                margin: 0;
                padding: 0;
                display: flex;
                flex-wrap: wrap;
                justify-content: space-around;
                }

                # Styling for each theme preview item
                li {
                width: 500px;
                min-width: fit-content;
                border: 1px solid gray;
                background-color: whitesmoke;
                border-radius: 5px;
                margin: 25px 50px;
                text-align: center;
                }

                # Hover effect for theme preview items
                li:hover {
                background-color: lightgray;
                }

                # Styling for theme preview links and images
                a {
                display: block;
                text-decoration: none;
                color: black;
                font-size: 1.5em;
                }

                # Styling for theme preview screenshots
                img {
                max-width:450px;
                border-radius: 5px;
                margin: 25px auto;
                border: 1px solid black;
                }

                # Styling for the footer section with success and failure counts
                footer {
                margin: 20px auto;
                text-align: center;
                font-size: 1.1em;
                }

                # Styling for the success and failure links in the footer
                footer a {
                display: inline;
                font-size: 1em;
                }

                # Color coding for success and failure links in the footer
                footer a.success {
                color: green;
                }

                # Color coding for failure links in the footer
                footer a.fail {
                color: red;
                }

            </style>
        </head>
    <body>

    <h1>pelican-themes Preview</h1>
    <ul>
"""

## Footer template for the generated index and failed themes pages, with placeholders for success and failure counts
HTML_FOOTER = """\
    </ul>

    <footer>
        Successfully built <a href="index.html" class="success">{success} themes</a><br/>
        Failed to build <a href="failed.html" class="fail">{fail} themes</a>
    </footer>

    </body>
    </html>
"""

## HTML template for the generated 404 page
HTML_404 = """\
    <!DOCTYPE html>
    <html>
        <head>
            <title>Not Found</title>
        </head>

        <style>
            h1 {
            margin: 20px auto;
            text-align: center;
            }
            p {text-align: center;}
            h3 {text-align: center;}
            a {color: black;}
            .center {
            display: block;
            margin-left: auto;
            margin-right: auto;
            width: 50%;
            }
        </style>

        # Simple 404 page with a message and a link back to the homepage, using a sad pelican image for visual interest
        <body>
            <h1>Not Found</h1>
            <h3>What you’re looking for isn’t here. <br> It may have moved, or something unfortunate may have befallen it.</h3>
            <p>Double-check the URL and try again, or <a href="https://pelicanthemes.com">head home</a>.</p>
            <img src="pelican-sad.png" alt="sad pelican" class="center">

        </body>
    </html>
"""

####################################################################################################
# Functions
def setup_folders(args):
    """ Set up the necessary folders for theme preview generation, including the theme root,
        samples root, output root, and screenshot root.
        
        Creates the output and screenshot folders if they do not already exist, and checks for the
        existence of the samples folder. If the samples folder does not exist, raises a RuntimeError
        with instructions for obtaining it.
        
        Returns the absolute paths for the theme root, samples root, output root,
        and screenshot root as a tuple.
    """

    theme_root = os.path.abspath(os.path.dirname(__file__))
    output_root = os.path.abspath(os.path.join(theme_root, args.output))
    samples_root = os.path.abspath(os.path.join(theme_root, args.samples))
    screenshot_root = os.path.abspath(os.path.join(output_root, "_screenshots"))

    # requires `getpelican/pelican` cloned in `_pelican` folder
    if os.path.exists(samples_root):
        os.makedirs(os.path.join(samples_root, "content", "images"), exist_ok=True)   # silence warning
    else:
        raise RuntimeError(
            f"Samples folder does not exist: {samples_root}. "
            "You can use `samples` from pelican by cloning it to `_pelican` folder"
        )
    # create output and screenshot folders
    os.makedirs(output_root, exist_ok=True)
    os.makedirs(screenshot_root, exist_ok=True)

    return theme_root, samples_root, output_root, screenshot_root

def build_theme_previews(theme_root, samples_root, output_root, screenshot_root):
    """ Build theme previews by generating static sites for each theme using Pelican and taking
        screenshots of the generated sites.
    """

    themes = [item for item in os.listdir(theme_root) if os.path.isdir(item) and not item.startswith((".", "_"))]
    logger.info(f"processing {len(themes)} themes...")

    # launch web server for taking screenshots
    server = subprocess.Popen(
        ["python", "-m", "http.server", "-d", output_root],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )

    fail = {}
    success = {}
    screenshot_processes = []

    modified_settings_path = os.path.join(output_root, "pelicanconf.py")
    with open(os.path.join(samples_root, 'pelican.conf.py')) as infile:
        with open(modified_settings_path, 'w') as outfile:
            outfile.write(infile.read() + PELICANCONF_PATCH)

    for theme in sorted(themes, key=lambda x: x.lower()):
        theme_path = os.path.join(theme_root, theme)
        if os.path.exists(os.path.join(theme_path, theme, "templates")):
            # actual theme is in a subfolder
            theme_path = os.path.join(theme_path, theme)
        output_path = os.path.join(output_root, theme)
        try:
            process = subprocess.run([
                "pelican",
                os.path.join(samples_root, "content"),
                "--settings", modified_settings_path,
                "--extra-settings", f"SITENAME=\"{theme} preview\"",
                "--relative-urls",
                "--theme-path", theme_path,
                "--output", output_path,
                "--ignore-cache",
                "--delete-output-directory",
            ],
            check=True, capture_output=True, universal_newlines=True)
        except subprocess.CalledProcessError as exc:
            logger.error(f"[red]failed to generate     : {theme}[/]", extra={"markup": True})
            fail[theme] = exc.stdout
            continue
        success[theme] = output_path
        screenshot_path = os.path.join(screenshot_root, f"{theme}.png")
        screenshot_processes.append(
            subprocess.Popen(
                ["shot-scraper", f"http://localhost:8000/{theme}", "-o", screenshot_path, "-w", "1280", "-h", "780", "--wait", "1000"],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
        )
        logger.info(f"[green]successfully generated : {theme}[/]", extra={"markup": True})

    # cleanup
    logger.info("finalizing screenshots...")
    for process in screenshot_processes:
        process.wait()
    server.terminate()
    os.remove(modified_settings_path)
    return success, fail

def write_index_files(output_root, success, fail):
    """ Write the index.html file for successfully generated themes and the failed.html file
        for themes that failed to generate.
    """

    logger.info("generating index files...")
    with open(os.path.join(output_root, "index.html"), "w") as outfile:
        outfile.write(HTML_HEADER)
        for theme, theme_path in sorted(success.items(), key=lambda x: x[0].lower()):
            outfile.write(f'<li><a href="{theme}">{theme}<br><img src="_screenshots/{theme}.png"/></a></li>')
        outfile.write(HTML_FOOTER.format(success=len(success), fail=len(fail)))

    with open(os.path.join(output_root, "failed.html"), "w") as outfile:
        outfile.write(HTML_HEADER)
        for theme, reason in sorted(fail.items(), key=lambda x: x[0].lower()):
            outfile.write(f'<li><h2>{theme}</h2><pre>{reason}</pre></li>')
        outfile.write(HTML_FOOTER.format(success=len(success), fail=len(fail)))

    logger.info(f"built {len(success)} themes")
    logger.info(f"failed {len(fail)} themes")

def write_404_file(output_root):
    """ Write the 404.html file for the generated theme previews, using a simple template
        with a message and a link back to the homepage, along with a sad pelican image for
        visual interest.
    """

    logger.info("generating 404 page file...")
    with open(os.path.join(output_root, "404.html"), "w") as outfile:
        outfile.write(HTML_404)

    pelican_pic_path = os.path.join(output_root, "pelican-sad.png")
    subprocess.call(["cp", "pelican-sad.png", pelican_pic_path])

    logger.info("wrote 404 page file")

def parse_args(argv=None):
    """ Parse command-line arguments for the theme preview generation script, including options for
        specifying the output folder and the sample website used for generating previews.

        Returns the parsed arguments as a Namespace object.
    """

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output", required=False, default="_output",
        help="Output folder for generating the theme previews. Defaults to `_output` in themes folder root."
    )
    parser.add_argument(
        "--samples", required=False, default="_pelican/samples",
        help="Sample website used to generate theme previews. Defaults to `_pelican/samples` in themes folder root."
    )
    return parser.parse_args(argv)

def check_requirements():
    """ Check for the required dependencies, including Pelican and shot-scraper, by
        attempting to run their version commands. If either dependency is not found,
        raises a RuntimeError with instructions for installing it."""

    try:
        proc = subprocess.run(
            ["pelican", "--version"],
            check=True, capture_output=True, universal_newlines=True
        )
        logger.info("using pelican: {}".format(proc.stdout.strip()))
    except subprocess.CalledProcessError:
        raise RuntimeError("Requires `pelican`, see https://docs.getpelican.com")
    try:
        proc = subprocess.run(
            ["shot-scraper", "--version"],
            check=True, capture_output=True, universal_newlines=True
        )
        logger.info("using shot-scraper: {}".format(proc.stdout.strip()))
    except subprocess.CalledProcessError:
        raise RuntimeError("Requires `shot-scraper`, see https://shot-scraper.data")

####################################################################################################
# Main
def main(argv=None):
    """ Main function for the theme preview generation script, which checks for requirements,
        parses command-line arguments, sets up necessary folders, builds theme previews,
        and writes index and 404 files.
    """

    check_requirements()
    args = parse_args(argv)
    theme_root, samples_root, output_root, screenshot_root = setup_folders(args)
    success, fail = build_theme_previews(theme_root, samples_root, output_root, screenshot_root)
    write_index_files(output_root, success, fail)
    write_404_file(output_root)

if __name__ == "__main__":
    main()

####################################################################################################