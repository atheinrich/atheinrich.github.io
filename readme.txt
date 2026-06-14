OVERVIEW
========
Much headache has gone into this, but here's where things are at.

The main site is constructed manually in /extra.
Anything in this folder is added to the site's root.

The blog stuff is managed by Pelican, which uses Jinja.
Posts and assets are added in /content.
HTML and CSS are edited in /themes.
Compilation is done automatically after running and of the following:
	_preview_pelican.bat: locally runs the blog aspect of the site alone
	_preview.bat:         locally runs the entire site
	_push_output.bat:     commits the site files alone to git
	_push_source.bat:     commits the source files along to git

Blog posts are designed to be human-readable as written and come in two flavors: 
	- Articles are html files that can be categorized and show up in lists.
	- Pages are standalone html files that are never categorized.
Posts are essentially instances of class objects in Pelican.
They have properties, such as titles and dates.

Big-picture details can be configured in pelicanconf.py -- see themes for examples.


DIRECTORY
---------
<local>/
├── content/						# Pelican posts are written here
│   ├── <category>/					# categorized container for posts 
│   │   └── <post>.rst
│   ├── pages/						# uncategorized container for pages
│   │   └── <post>.md
│   └── images/						# full gallery of assets
│        └── <image>.png
├── themes/							# styling for Pelican
│   ├── .github/workflows/			# scripts for deploying updates
│   └── <theme>/					# html, css, and jinja configuration
│       ├── static/					# visual aspects like color and images
│       |   ├── css/				# styling
│       |   │   ├── main.css		# ?
│       |   │   ├── pygment.css		# ?
│       |   │   ├── reset.css		# ?
│       |   │   └── wide.css		# ?
│       |   ├── images/				# assets
│       |   ├── js/					# (unused)
│       |   ├── audio/				# (unused)
│       |   └── fonts/				# (unused)
│       └── templates/				# underlying code for styling with jinja/html
│           ├── archives.html		# (optional)  list of all articles/posts
│           ├── article_infos.html	# (optional)  displaying metadata near an article
│           ├── article.html		# (important) individual blog post page
│           ├── base.html			# (important) master template for theme
│           ├── categories.html		# (optional)  list of all categories
│           ├── category.html		# (optional)  single category page
│           ├── comments.html		# (optional)  comments via Disqus
│           ├── disqus_script.html	# (optional)  comments via Disqus
│           ├── github.html			# (optional)  github fork button
│           ├── index.html			# (important) blog articles
│           ├── page.html			# (important) individual blob post page
│           ├── tag.html			# (optional)  tags from posts
│           ├── taglist.html		# (optional)  tags from posts
│           └── tags.html			# (optional)  tags from posts
├── extra/							# manual additions to the website's root
│   ├── elements.css	 			# style for the nekoweb tile
│   ├── home.html		 			# after entryway
│   ├── index.html		 			# first page viewed by visitors
│   ├── not_found.html		 		# error page
│   └── style.css			 		# style for main pages
├── pelicanconf.py					# backend config for Pelican
├── publishconf.py					# ?
└── output/							# results pushed to github


INSTALLATION
------------
python -m pip install "pelican[markdown]"
python -m pip install pelican-render-math
pip install ghp-import
pelican-quickstart


CONTENT
-------
- Navigate to the \content folder.
- Navigate to a caregory, such as \math or \pages.
- Copy one of the pre-existing md or rst files.
- Edit as desired and save under an arbitrary name.
- Preview and push.


DEBUGGING
---------
Try this if git gets angry.
	git remote -v
	git fetch origin main

Try this if you don't know what's wrong.
	pelican content/ --debug --verbose


OTHER
-----
The package pelican-render-math must be installed for equation formatting.
I added deploy.yaml to .github\workflows to push directly to nekoweb.
