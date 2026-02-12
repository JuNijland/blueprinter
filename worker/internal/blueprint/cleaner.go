package blueprint

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/yosssi/gohtml"
	"golang.org/x/net/html"
)

// Clean removes noise from raw HTML to make it suitable for XPath generation.
// It strips scripts, styles, hidden elements, framework attributes, empty nodes, and SVGs.
func Clean(rawHTML string) (string, error) {
	doc, err := html.Parse(strings.NewReader(rawHTML))
	if err != nil {
		return "", fmt.Errorf("parsing HTML: %w", err)
	}

	removeFrameworkBloat(doc)
	pruneAttributes(doc)
	removeHiddenContent(doc)
	normalizeWhitespace(doc)
	removeRedundantElements(doc)
	removeSVGContent(doc)

	return formatHTML(doc), nil
}

func renderHTML(n *html.Node) string {
	var buf bytes.Buffer
	if err := html.Render(&buf, n); err != nil {
		return ""
	}
	return buf.String()
}

func formatHTML(n *html.Node) string {
	return gohtml.Format(renderHTML(n))
}

func removeFrameworkBloat(n *html.Node) {
	if n.Type == html.ElementNode {
		tagName := strings.ToLower(n.Data)
		if tagName == "style" || tagName == "link" || tagName == "meta" || tagName == "noscript" {
			removeNode(n)
			return
		}

		if tagName == "script" {
			scriptType := getAttr(n, "type")
			if scriptType != "application/ld+json" && scriptType != "application/json" {
				removeNode(n)
				return
			}
		}

		frameworkPrefixes := []string{
			"data-react", "data-reactid", "data-reactroot",
			"data-vue", "data-v-",
			"ng-", "data-ng-",
			"data-testid", "data-test", "data-qa",
			"data-gtm", "data-analytics", "data-tracking",
		}

		var keepAttrs []html.Attribute
		for _, attr := range n.Attr {
			keep := true
			lowerKey := strings.ToLower(attr.Key)
			for _, prefix := range frameworkPrefixes {
				if strings.HasPrefix(lowerKey, prefix) {
					keep = false
					break
				}
			}
			if keep {
				keepAttrs = append(keepAttrs, attr)
			}
		}
		n.Attr = keepAttrs
	}

	for c := n.FirstChild; c != nil; {
		next := c.NextSibling
		removeFrameworkBloat(c)
		c = next
	}
}

func pruneAttributes(n *html.Node) {
	if n.Type == html.ElementNode {
		allowedAttrs := map[string]bool{
			"id": true, "class": true, "href": true, "src": true,
			"alt": true, "type": true, "name": true, "value": true,
			"itemprop": true, "itemtype": true, "itemscope": true,
		}

		var newAttrs []html.Attribute
		for _, attr := range n.Attr {
			if allowedAttrs[strings.ToLower(attr.Key)] {
				newAttrs = append(newAttrs, attr)
			}
		}
		n.Attr = newAttrs
	}

	for c := n.FirstChild; c != nil; c = c.NextSibling {
		pruneAttributes(c)
	}
}

func removeHiddenContent(n *html.Node) {
	for c := n.FirstChild; c != nil; {
		next := c.NextSibling
		if c.Type == html.ElementNode {
			tagName := strings.ToLower(c.Data)
			if tagName == "template" {
				removeNode(c)
				c = next
				continue
			}

			if hasAttr(c, "hidden") {
				removeNode(c)
				c = next
				continue
			}

			class := strings.ToLower(getAttr(c, "class"))
			hiddenClasses := []string{"hidden", "invisible", "d-none", "hide", "sr-only"}
			removed := false
			for _, hc := range hiddenClasses {
				if strings.Contains(class, hc) {
					removeNode(c)
					removed = true
					break
				}
			}
			if removed {
				c = next
				continue
			}

			style := strings.ToLower(getAttr(c, "style"))
			if strings.Contains(style, "display:none") ||
				strings.Contains(style, "display: none") ||
				strings.Contains(style, "visibility:hidden") ||
				strings.Contains(style, "visibility: hidden") {
				removeNode(c)
				c = next
				continue
			}

			removeHiddenContent(c)
		}
		c = next
	}
}

func normalizeWhitespace(n *html.Node) {
	if n.Type == html.TextNode {
		text := strings.TrimSpace(n.Data)
		text = strings.Join(strings.Fields(text), " ")
		n.Data = text
	}

	for c := n.FirstChild; c != nil; c = c.NextSibling {
		normalizeWhitespace(c)
	}
}

func removeRedundantElements(n *html.Node) {
	for c := n.FirstChild; c != nil; {
		next := c.NextSibling
		if c.Type == html.ElementNode {
			tagName := strings.ToLower(c.Data)
			if (tagName == "div" || tagName == "span") && len(c.Attr) == 0 && isEmpty(c) {
				removeNode(c)
				c = next
				continue
			}
			removeRedundantElements(c)
		}
		c = next
	}
}

func removeSVGContent(n *html.Node) {
	for c := n.FirstChild; c != nil; {
		next := c.NextSibling
		if c.Type == html.ElementNode && strings.EqualFold(c.Data, "svg") {
			removeNode(c)
			c = next
			continue
		}
		if c.Type == html.ElementNode {
			removeSVGContent(c)
		}
		c = next
	}
}

func removeNode(n *html.Node) {
	if n.Parent != nil {
		n.Parent.RemoveChild(n)
	}
}

func getAttr(n *html.Node, key string) string {
	for _, attr := range n.Attr {
		if strings.EqualFold(attr.Key, key) {
			return attr.Val
		}
	}
	return ""
}

func hasAttr(n *html.Node, key string) bool {
	for _, attr := range n.Attr {
		if strings.EqualFold(attr.Key, key) {
			return true
		}
	}
	return false
}

func isEmpty(n *html.Node) bool {
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.TextNode && strings.TrimSpace(c.Data) != "" {
			return false
		}
		if c.Type == html.ElementNode {
			return false
		}
	}
	return true
}
